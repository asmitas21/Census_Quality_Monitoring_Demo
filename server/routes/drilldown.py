"""Drilldown, explainability, demographics, collection modes, and geography hierarchy."""
from typing import Any
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from server.auth import Entitlement, require_auth
from server.config import get_workspace_host
from server.mock_data import (
    get_trend,
    get_top_contributors,
    get_demographic_breakdown,
    get_collection_mode_breakdown,
    get_geography_children,
    get_quality_bands,
    _ANOMALY_POOL,
    DEMOGRAPHIC_DIMENSIONS,
)
from server.uc_client import (
    get_anomaly_score,
    get_root_cause,
    get_time_travel_data,
    execute_sql,
    CATALOG,
    SCHEMA,
)

router = APIRouter(prefix="/drilldown", tags=["drilldown"])


@router.get("")
async def get_drilldown(
    anomaly_id: str = Query(...),
    geography_level: str = Query("county"),
    time_granularity: str = Query("weekly"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Trend series, top contributors, and distribution for an anomaly."""
    idx = int(anomaly_id.replace("a", "")) - 1 if anomaly_id.startswith("a") else 0
    anomaly = _ANOMALY_POOL[idx % len(_ANOMALY_POOL)]

    return {
        "anomaly_id": anomaly_id,
        "kpi": anomaly["kpi"],
        "geography": anomaly["geography"],
        "severity": anomaly["severity"],
        "delta_pct": anomaly["delta_pct"],
        "persistence_weeks": anomaly["persistence_weeks"],
        "trend": get_trend(anomaly_id, time_granularity),
        "top_contributors": get_top_contributors(anomaly_id),
        "distribution": "localized_spike" if anomaly["persistence_weeks"] <= 2 else "broad_shift",
        "collection_modes": get_collection_mode_breakdown(anomaly["kpi"]),
        "quality_bands": get_quality_bands(anomaly["geography_id"]),
    }


@router.get("/explain")
async def get_explain(
    anomaly_id: str = Query(...),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Explainability: top geos/segments, trend onset, broad vs localized."""
    idx = int(anomaly_id.replace("a", "")) - 1 if anomaly_id.startswith("a") else 0
    anomaly = _ANOMALY_POOL[idx % len(_ANOMALY_POOL)]
    contributors = get_top_contributors(anomaly_id)

    return {
        "anomaly_id": anomaly_id,
        "kpi": anomaly["kpi"],
        "geography": anomaly["geography"],
        "top_geographies": [{"name": c["geography"], "delta_pct": c["delta_pct"]} for c in contributors[:3]],
        "onset_period": "2026-W06",
        "distribution_type": "localized_spike" if anomaly["persistence_weeks"] <= 2 else "broad_shift",
        "persistence_weeks": anomaly["persistence_weeks"],
        "severity": anomaly["severity"],
    }


@router.get("/demographics")
async def get_demographics(
    anomaly_id: str = Query(None),
    kpi_name: str = Query("Overall Response Rate"),
    dimension: str = Query("age_group"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Demographic breakdown for a KPI."""
    if entitlement == Entitlement.TITLE_13_ONLY:
        # Title 13 only users cannot see demographic breakdowns
        return {"error": "Demographic data requires Title 13 + Title 26 entitlement", "items": []}

    return {
        "kpi_name": kpi_name,
        "dimension": dimension,
        "available_dimensions": list(DEMOGRAPHIC_DIMENSIONS.keys()),
        "items": get_demographic_breakdown(kpi_name, dimension),
    }


@router.get("/collection-modes")
async def get_collection_modes(
    kpi_name: str = Query("Overall Response Rate"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Collection mode breakdown for a KPI."""
    return {
        "kpi_name": kpi_name,
        "items": get_collection_mode_breakdown(kpi_name),
    }


@router.get("/geography")
async def get_geography_hierarchy(
    parent_id: str | None = Query(None),
    level: str = Query("state"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Geography hierarchy navigation: State → County → Tract → Block Group."""
    children = get_geography_children(parent_id, level)
    next_levels = {"state": "county", "county": "tract", "tract": "block_group", "block_group": None}
    return {
        "parent_id": parent_id,
        "level": level,
        "next_level": next_levels.get(level),
        "children": children,
    }


@router.get("/risk-score/{county_fips}")
async def get_risk_score(
    county_fips: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Risk score detail for a single county from anomaly_scores."""
    score = get_anomaly_score(county_fips)
    if not score:
        rc = get_root_cause(county_fips)
        if rc:
            return {
                "county_fips": county_fips,
                "county_name": rc.get("county_name", "Unknown"),
                "state_abbr": rc.get("state_abbr", ""),
                "risk_score": 0,
                "risk_tier": "Low",
                "trend": "stable",
                "factors": [],
                "score_updated_at": datetime.utcnow().isoformat() + "Z",
                "score_delta": 0,
                "lineage": [f"{CATALOG}.{SCHEMA}.root_cause_join"],
            }
        return {
            "county_fips": county_fips,
            "county_name": f"County {county_fips}",
            "state_abbr": "",
            "risk_score": 0,
            "risk_tier": "Low",
            "trend": "stable",
            "factors": [],
            "score_updated_at": datetime.utcnow().isoformat() + "Z",
            "score_delta": 0,
            "lineage": [],
        }

    risk = float(score.get("risk_score") or 0)
    tier = "Critical" if risk > 0.9 else "High" if risk > 0.75 else "Moderate" if risk > 0.5 else "Low"
    delta = float(score.get("score_delta") or 0)
    trend = "worsening" if delta > 0.05 else "improving" if delta < -0.05 else "stable"
    factors = []
    for i in range(1, 4):
        name = score.get(f"top_factor_{i}")
        weight = score.get(f"top_factor_{i}_weight")
        if name:
            factors.append({"name": name, "weight": float(weight) if weight else 0})

    return {
        "county_fips": county_fips,
        "county_name": score.get("county_name", ""),
        "state_abbr": score.get("state_abbr", ""),
        "risk_score": risk,
        "risk_tier": tier,
        "trend": trend,
        "factors": factors,
        "score_updated_at": score.get("score_updated_at", ""),
        "score_delta": delta,
        "lineage": [f"{CATALOG}.{SCHEMA}.anomaly_scores"],
    }


@router.get("/time-travel/{county_fips}")
async def get_time_travel(
    county_fips: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Tract-level 2010→2020 response trend for a county via Delta Lake time travel."""
    tracts = get_time_travel_data(county_fips)
    if not tracts:
        rc = get_root_cause(county_fips)
        return {
            "county_fips": county_fips,
            "county_name": rc.get("county_name", f"County {county_fips}") if rc else f"County {county_fips}",
            "state_abbr": rc.get("state_abbr", "") if rc else "",
            "query_sql": f"SELECT * FROM {CATALOG}.{SCHEMA}.tract_response_history WHERE county_fips = '{county_fips}'",
            "queried_at": datetime.utcnow().isoformat() + "Z",
            "national_avg_2020": 67.0,
            "summary": {"tract_count": 0, "avg_delta": 0, "min_delta": 0, "max_delta": 0,
                         "severe_decline_count": 0, "moderate_decline_count": 0, "stable_count": 0, "improved_count": 0},
            "tracts": [],
            "lineage": [f"{CATALOG}.{SCHEMA}.tract_response_history"],
        }

    first = tracts[0]
    deltas = [float(t.get("delta") or 0) for t in tracts]
    formatted_tracts = []
    severe = moderate = stable = improved = 0
    for t in tracts:
        d = float(t.get("delta") or 0)
        r2010 = float(t.get("crrall_2010") or 0)
        r2020 = float(t.get("crrall_2020") or 0)
        formatted_tracts.append({
            "tract_fips": t.get("tract_fips", ""),
            "tract_name": t.get("tract_name", ""),
            "rate_2010": r2010,
            "rate_2020": r2020,
            "delta": d,
        })
        if d < -20:
            severe += 1
        elif d < -5:
            moderate += 1
        elif d <= 5:
            stable += 1
        else:
            improved += 1

    return {
        "county_fips": county_fips,
        "county_name": first.get("county_name", ""),
        "state_abbr": first.get("state_abbr", ""),
        "query_sql": f"SELECT * FROM {CATALOG}.{SCHEMA}.tract_response_history WHERE county_fips = '{county_fips}' ORDER BY delta",
        "queried_at": datetime.utcnow().isoformat() + "Z",
        "national_avg_2020": 67.0,
        "summary": {
            "tract_count": len(formatted_tracts),
            "avg_delta": round(sum(deltas) / len(deltas), 1) if deltas else 0,
            "min_delta": round(min(deltas), 1) if deltas else 0,
            "max_delta": round(max(deltas), 1) if deltas else 0,
            "severe_decline_count": severe,
            "moderate_decline_count": moderate,
            "stable_count": stable,
            "improved_count": improved,
        },
        "tracts": formatted_tracts,
        "lineage": [f"{CATALOG}.{SCHEMA}.tract_response_history"],
    }


@router.get("/root-cause/{county_fips}")
async def get_root_cause_detail(
    county_fips: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Root cause analysis for a county from root_cause_join."""
    rc = get_root_cause(county_fips)
    if not rc:
        return {"root_cause": None, "lineage": []}

    return {
        "root_cause": {
            "rank": rc.get("root_cause_rank", "Unknown"),
            "response_rate": float(rc.get("crrall") or 0),
            "internet_rate": float(rc.get("crrint") or 0),
            "pct_no_broadband": float(rc.get("pct_no_broadband") or 0),
            "pct_undeliverable": float(rc.get("pct_undeliverable") or 0),
            "pct_limited_english": float(rc.get("pct_spanish_limited_english") or 0),
            "pct_renter": float(rc.get("pct_renter") or 0),
        },
        "lineage": [
            f"{CATALOG}.{SCHEMA}.root_cause_join",
            f"{CATALOG}.{SCHEMA}.anomaly_scores",
            "fcc.broadband_coverage",
            "usps.undeliverable_rates",
        ],
    }


@router.get("/methodology/{county_fips}")
async def get_methodology(
    county_fips: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Methodology chunks relevant to a county's root cause."""
    rc = get_root_cause(county_fips)
    county_name = rc.get("county_name", f"County {county_fips}") if rc else f"County {county_fips}"

    keyword_reasons: list[tuple[str, str, str]] = []
    if rc:
        bb = float(rc.get("pct_no_broadband") or 0)
        lang = float(rc.get("pct_spanish_limited_english") or 0)
        undlv = float(rc.get("pct_undeliverable") or 0)
        rent = float(rc.get("pct_renter") or 0)
        if bb > 20:
            keyword_reasons.append(("internet", "Internet Access Gap", f"{bb:.1f}% lack broadband"))
        if undlv > 10:
            keyword_reasons.append(("undeliverable", "Mail Deliverability", f"{undlv:.1f}% undeliverable"))
        if lang > 15:
            keyword_reasons.append(("language", "Language Barrier", f"{lang:.1f}% limited English"))
        if rent > 40:
            keyword_reasons.append(("renter", "Renter Mobility", f"{rent:.1f}% renter households"))
    if not keyword_reasons:
        keyword_reasons = [
            ("self-response", "Self-Response Operations", "General methodology"),
            ("enumeration", "Field Enumeration", "General methodology"),
        ]
    else:
        keyword_reasons.append(("self-response", "Self-Response Operations", "General methodology"))

    chunks = []
    seen_docs: set[str] = set()
    for kw, reason_label, reason_detail in keyword_reasons:
        if len(chunks) >= 4:
            break
        sql = (
            f"SELECT chunk_id, document_name, LEFT(content, 400) AS content "
            f"FROM {CATALOG}.{SCHEMA}.document_chunks "
            f"WHERE LOWER(content) LIKE '%{kw}%' AND LENGTH(content) > 100 "
            f"ORDER BY LENGTH(content) DESC LIMIT 5"
        )
        try:
            rows = execute_sql(sql)
            for r in rows:
                doc = r.get("document_name", "")
                if doc in seen_docs:
                    continue
                seen_docs.add(doc)
                chunk_id = r.get("chunk_id", "")
                page = ""
                if "_p" in chunk_id:
                    page = chunk_id.split("_p")[1].split("_")[0]
                ws_host = get_workspace_host()
                volume_url = (
                    f"{ws_host}/explore/data/volumes/census_operations_demo/operations/census_documents/{doc}"
                )
                chunks.append({
                    "id": chunk_id,
                    "source_doc": doc,
                    "section_title": doc.replace(".pdf", "").replace("_", " ").title(),
                    "text": (r.get("content") or "").strip(),
                    "page": page,
                    "relevance_reason": reason_label,
                    "relevance_detail": reason_detail,
                    "volume_url": volume_url,
                })
                break
        except Exception as e:
            print(f"Methodology query failed for '{kw}': {e}")

    return {
        "county_fips": county_fips,
        "county_name": county_name,
        "queried_at": datetime.utcnow().isoformat() + "Z",
        "chunks": chunks,
        "chunk_count": len(chunks),
        "lineage": [f"{CATALOG}.{SCHEMA}.document_chunks"],
    }
