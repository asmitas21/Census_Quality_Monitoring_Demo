"""Snapshot overview and KPI APIs - Using Real Census Data."""
from typing import Any
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from server.auth import Entitlement, require_auth
from server.services.safe_output import ensure_safe_output
from server.census_data import (
    get_kpis, 
    get_anomalies as get_top_anomalies, 
    get_hotspots, 
    get_map_data,
    get_demographic_comparison,
    get_state_data,
    get_county_data,
    get_tract_data,
    NATIONAL_BENCHMARKS,
)
from server.mock_data import get_quality_bands  # Keep this for now
from server.uc_client import (
    get_high_risk_counties,
    get_state_risk_scores,
    get_state_counties_enhanced,
    get_all_counties_for_histogram,
    get_scatterplot_data,
    get_filter_options,
    get_high_risk_counties_filtered,
    get_tracts_for_county,
    get_counties_by_crrall_range,
    get_real_metric_views,
    get_composite_metrics,
    get_metric_grants,
    grant_metric_access,
    revoke_metric_access,
    get_national_county_layer,
)
from server.config import get_workspace_host

router = APIRouter(prefix="/snapshot", tags=["snapshot"])


@router.get("/me")
async def get_me(
    request: Request,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Return current user identity and entitlement level."""
    email = getattr(request.state, "user_email", None) or request.headers.get("X-Forwarded-Email", "local-dev@demo.gov")
    return {
        "email": email,
        "entitlement": entitlement.value,
        "groups": ["title13_authorized"] + (["title26_authorized"] if entitlement == Entitlement.TITLE_13_AND_26 else []),
    }


@router.get("/overview")
async def get_snapshot_overview(
    time_window: str = Query("weekly"),
    geography: str | None = Query(None),
    kpi_group: str = Query("response_rate"),  # Default to response_rate for Census
    benchmark_set: str = Query("2020_census"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Aggregated KPIs, top anomalies, hotspot summary - powered by real Census data."""
    
    # Get real Census data
    kpis = get_kpis(kpi_group)
    anomalies = get_top_anomalies(kpi_group=kpi_group, limit=5)
    hotspots = get_hotspots(kpi_group=kpi_group, limit=8)
    
    # AI-generated summary of what needs attention
    high_severity = [a for a in anomalies if a.get("severity") == "high"]
    ai_summary = _generate_ai_summary(kpis, anomalies)
    
    raw = {
        "kpis": kpis,
        "top_anomalies": anomalies,
        "hotspots": hotspots,
        "quality_bands": get_quality_bands(geography),
        "ai_summary": ai_summary,
        "national_benchmarks": NATIONAL_BENCHMARKS,
        "last_refreshed": datetime.utcnow().isoformat() + "Z",
        "time_window": time_window,
        "kpi_group": kpi_group,
        "benchmark_set": benchmark_set,
        "data_source": "Real Census Bureau 2020 Decennial + ACS Data",
    }
    return ensure_safe_output(entitlement, raw) or raw


@router.get("/map")
async def get_snapshot_map(
    kpi_group: str = Query("response_rate"),
    time_window: str = Query("weekly"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Per-state KPI values for choropleth map - real 2020 Census response rates."""
    return {
        "states": get_map_data(kpi_group),
        "kpi_group": kpi_group,
        "time_window": time_window,
        "data_source": "2020 Decennial Census Response Rates",
    }


@router.get("/demographics/{geography_id}")
async def get_geography_demographics(
    geography_id: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get collected vs expected demographics for gap analysis."""
    comparison = get_demographic_comparison(geography_id)
    if not comparison:
        return {"error": "Geography not found", "geography_id": geography_id}
    
    return {
        "comparison": comparison,
        "data_source": "ACS 5-Year Estimates + 2020 Decennial Census",
    }


@router.get("/states")
async def get_all_states(
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get all states with response rates and demographics."""
    return {
        "states": get_state_data(),
        "data_source": "2020 Decennial Census + ACS Demographics",
    }


@router.get("/counties/{state_fips}")
async def get_state_counties(
    state_fips: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get counties for a state with response rates."""
    return {
        "counties": get_county_data(state_fips),
        "state_fips": state_fips,
        "data_source": "2020 Decennial Census Response Rates",
    }


STATE_FIPS_TO_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY", "72": "PR",
}

STATE_FIPS_TO_NAME = {
    "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas", "06": "California",
    "08": "Colorado", "09": "Connecticut", "10": "Delaware", "11": "District of Columbia",
    "12": "Florida", "13": "Georgia", "15": "Hawaii", "16": "Idaho", "17": "Illinois",
    "18": "Indiana", "19": "Iowa", "20": "Kansas", "21": "Kentucky", "22": "Louisiana",
    "23": "Maine", "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
    "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska", "32": "Nevada",
    "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico", "36": "New York",
    "37": "North Carolina", "38": "North Dakota", "39": "Ohio", "40": "Oklahoma", "41": "Oregon",
    "42": "Pennsylvania", "44": "Rhode Island", "45": "South Carolina", "46": "South Dakota",
    "47": "Tennessee", "48": "Texas", "49": "Utah", "50": "Vermont", "51": "Virginia",
    "53": "Washington", "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
    "72": "Puerto Rico",
}


@router.get("/counties-enhanced/{state_fips}")
async def get_state_counties_with_risk(
    state_fips: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get counties for a state with CRRALL, CRRINT, and risk scores from UC."""
    state_abbr = STATE_FIPS_TO_ABBR.get(state_fips, "")
    state_name = STATE_FIPS_TO_NAME.get(state_fips, "Unknown State")
    
    # Get base county data
    base_counties = get_county_data(state_fips)
    
    # Get risk scores from UC
    risk_scores = {}
    try:
        risk_scores = get_state_risk_scores(state_abbr) if state_abbr else {}
    except Exception as e:
        print(f"Could not fetch risk scores for {state_abbr}: {e}")
    
    # Get enhanced data from UC (if available)
    uc_counties = {}
    try:
        uc_data = get_state_counties_enhanced(state_fips)
        uc_counties = {c["county_fips"]: c for c in uc_data}
    except Exception as e:
        print(f"Could not fetch UC county data for {state_fips}: {e}")
    
    # Merge data
    enhanced = []
    for county in base_counties:
        fips = county["geography_id"]
        risk = risk_scores.get(fips, {})
        uc = uc_counties.get(fips, {})
        
        crrall = county.get("self_response_rate") or (float(uc.get("crrall")) if uc.get("crrall") else None)
        crrint = county.get("internet_response_rate") or (float(uc.get("crrint")) if uc.get("crrint") else None)
        risk_score = float(risk.get("risk_score")) if risk.get("risk_score") else None
        
        enhanced.append({
            "county_fips": fips,
            "county_name": county["geography"],
            "state_fips": state_fips,
            "crrall": crrall,
            "crrint": crrint,
            "risk_score": risk_score,
            "top_factor": risk.get("top_factor_1"),
            "score_delta": float(risk.get("score_delta")) if risk.get("score_delta") else None,
            "is_high_risk": risk_score is not None and risk_score > 0.75,
        })
    
    # Calculate state summary
    valid_crrall = [c["crrall"] for c in enhanced if c["crrall"] is not None]
    state_avg_crrall = sum(valid_crrall) / len(valid_crrall) if valid_crrall else None
    high_risk_count = sum(1 for c in enhanced if c["is_high_risk"])
    worst_county = min(enhanced, key=lambda x: x["crrall"] or 100) if enhanced else None
    
    return {
        "state_fips": state_fips,
        "state_abbr": state_abbr,
        "state_name": state_name,
        "counties": enhanced,
        "summary": {
            "total_counties": len(enhanced),
            "state_avg_crrall": round(state_avg_crrall, 1) if state_avg_crrall else None,
            "national_avg_crrall": 67.0,
            "gap_from_national": round(state_avg_crrall - 67.0, 1) if state_avg_crrall else None,
            "high_risk_count": high_risk_count,
            "worst_county_name": worst_county["county_name"] if worst_county else None,
            "worst_county_crrall": worst_county["crrall"] if worst_county else None,
            "worst_county_fips": worst_county["county_fips"] if worst_county else None,
        },
        "lineage": [
            "census_operations_demo.operations.root_cause_join",
            "census_operations_demo.operations.anomaly_scores",
        ],
    }


def _generate_ai_summary(kpis: list, anomalies: list) -> str:
    """Generate an AI-style summary of what needs attention."""
    high_severity = [a for a in anomalies if a.get("severity") == "high"]
    
    if not high_severity:
        return "All metrics are within acceptable ranges. No critical anomalies detected."
    
    # Find the worst anomalies
    worst = sorted(high_severity, key=lambda x: abs(x.get("delta_pct", 0)), reverse=True)[:3]
    
    summaries = []
    for a in worst:
        geo = a.get("geography", "Unknown")
        kpi = a.get("kpi", "Unknown metric")
        delta = a.get("delta_pct", 0)
        direction = "below" if delta < 0 else "above"
        summaries.append(f"{geo} is {abs(delta):.1f}% {direction} benchmark for {kpi}")
    
    return "Attention needed: " + "; ".join(summaries) + "."


@router.get("/high-risk-counties")
async def get_high_risk_counties_endpoint(
    min_risk_score: float = Query(0.75),
    limit: int = Query(10),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """
    Get counties with risk_score > threshold from Unity Catalog.
    Powers the Command Center anomaly cards.
    """
    counties = get_high_risk_counties(min_risk_score=min_risk_score, limit=limit)
    
    # Format response
    formatted = []
    for c in counties:
        risk_score = float(c["risk_score"]) if c.get("risk_score") else 0
        score_delta = float(c["score_delta"]) if c.get("score_delta") else 0
        crrall = float(c["crrall"]) if c.get("crrall") else None
        
        formatted.append({
            "county_fips": c["county_fips"],
            "county_name": c["county_name"],
            "state_abbr": c["state_abbr"],
            "risk_score": risk_score,
            "top_factor": c["top_factor_1"],
            "top_factor_weight": float(c["top_factor_1_weight"]) if c.get("top_factor_1_weight") else None,
            "score_delta": score_delta,
            "is_trending": score_delta > 0.08,
            "crrall": crrall,
            "score_updated_at": c.get("score_updated_at"),
        })
    
    return {
        "counties": formatted,
        "total": len(formatted),
        "threshold": min_risk_score,
        "lineage": [
            "census_operations_demo.operations.anomaly_scores",
            "census_operations_demo.operations.root_cause_join",
        ],
    }


@router.get("/histogram")
async def get_histogram_data(
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """
    Get CRRALL distribution across all counties for histogram visualization.
    Buckets counties into response rate ranges.
    """
    try:
        counties = get_all_counties_for_histogram()
    except Exception as e:
        print(f"Could not fetch histogram data from UC: {e}")
        counties = []
    
    # Define buckets
    buckets = [
        {"range": "0-10%", "min": 0, "max": 10, "count": 0, "severity": "critical"},
        {"range": "10-20%", "min": 10, "max": 20, "count": 0, "severity": "critical"},
        {"range": "20-30%", "min": 20, "max": 30, "count": 0, "severity": "critical"},
        {"range": "30-40%", "min": 30, "max": 40, "count": 0, "severity": "critical"},
        {"range": "40-50%", "min": 40, "max": 50, "count": 0, "severity": "severe"},
        {"range": "50-55%", "min": 50, "max": 55, "count": 0, "severity": "severe"},
        {"range": "55-60%", "min": 55, "max": 60, "count": 0, "severity": "moderate"},
        {"range": "60-65%", "min": 60, "max": 65, "count": 0, "severity": "moderate"},
        {"range": "65-70%", "min": 65, "max": 70, "count": 0, "severity": "good"},
        {"range": "70-80%", "min": 70, "max": 80, "count": 0, "severity": "good"},
        {"range": "80%+", "min": 80, "max": 100, "count": 0, "severity": "good"},
    ]
    
    # Count counties in each bucket
    total_crrall = 0
    valid_count = 0
    
    for county in counties:
        crrall = float(county["crrall"]) if county.get("crrall") else None
        if crrall is not None:
            total_crrall += crrall
            valid_count += 1
            for bucket in buckets:
                if bucket["min"] <= crrall < bucket["max"]:
                    bucket["count"] += 1
                    break
            else:
                if crrall >= 80:
                    buckets[-1]["count"] += 1
    
    national_avg = total_crrall / valid_count if valid_count > 0 else 67.0
    
    return {
        "buckets": buckets,
        "total_counties": valid_count,
        "national_benchmark": 67.0,
        "actual_national_avg": round(national_avg, 1),
        "lineage": ["census_operations_demo.operations.root_cause_join"],
    }


@router.get("/scatterplot-data")
async def get_scatterplot_data_endpoint(
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """
    Get federated join data for scatterplot visualizations.
    Joins root_cause_join + broadband_coverage + anomaly_scores.
    """
    try:
        data = get_scatterplot_data()
    except Exception as e:
        print(f"Could not fetch scatterplot data from UC: {e}")
        data = []
    
    # Format for frontend
    formatted = []
    for row in data:
        risk_score = float(row["risk_score"]) if row.get("risk_score") else None
        is_anomaly = risk_score is not None and risk_score > 0.75
        
        formatted.append({
            "county_fips": row["county_fips"],
            "county_name": row["county_name"],
            "state_abbr": row["state_abbr"],
            "crrall": float(row["crrall"]) if row.get("crrall") else None,
            "crrint": float(row["crrint"]) if row.get("crrint") else None,
            "pct_no_broadband": float(row["pct_no_broadband"]) if row.get("pct_no_broadband") else None,
            "pct_spanish_limited_english": float(row["pct_spanish_limited_english"]) if row.get("pct_spanish_limited_english") else None,
            "risk_score": risk_score,
            "is_anomaly": is_anomaly,
            "top_factor": row.get("top_factor_1"),
        })
    
    return {
        "counties": formatted,
        "total": len(formatted),
        "lineage": [
            "census_operations_demo.operations.root_cause_join",
            "census_operations_demo.operations.broadband_coverage",
            "census_operations_demo.operations.anomaly_scores",
        ],
    }


@router.get("/filter-options")
async def get_filter_options_endpoint(
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """
    Get distinct values for filter dropdowns.
    Returns unique states and risk factors from UC tables.
    """
    try:
        options = get_filter_options()
    except Exception as e:
        print(f"Could not fetch filter options from UC: {e}")
        options = {"states": [], "factors": []}
    
    return {
        "states": options.get("states", []),
        "factors": options.get("factors", []),
        "response_ranges": [
            {"label": "Below 30%", "min": 0, "max": 30},
            {"label": "30-50%", "min": 30, "max": 50},
            {"label": "50-65%", "min": 50, "max": 65},
            {"label": "Above 65%", "min": 65, "max": 100},
        ],
        "trending_options": ["All", "Trending worse", "Stable"],
    }


@router.get("/high-risk-counties-filtered")
async def get_high_risk_counties_filtered_endpoint(
    min_risk_score: float = Query(0.75),
    limit: int = Query(20),
    state: str | None = Query(None),
    risk_factor: str | None = Query(None),
    crrall_min: float | None = Query(None),
    crrall_max: float | None = Query(None),
    trending_only: bool = Query(False),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """
    Get filtered high-risk counties with multi-dimensional filters.
    """
    try:
        counties = get_high_risk_counties_filtered(
            min_risk_score=min_risk_score,
            limit=limit,
            state=state,
            risk_factor=risk_factor,
            crrall_min=crrall_min,
            crrall_max=crrall_max,
            trending_only=trending_only,
        )
    except Exception as e:
        print(f"Could not fetch filtered counties from UC: {e}")
        counties = []
    
    formatted = []
    for c in counties:
        risk_score = float(c["risk_score"]) if c.get("risk_score") else 0
        score_delta = float(c["score_delta"]) if c.get("score_delta") else 0
        crrall = float(c["crrall"]) if c.get("crrall") else None
        
        formatted.append({
            "county_fips": c["county_fips"],
            "county_name": c["county_name"],
            "state_abbr": c["state_abbr"],
            "risk_score": risk_score,
            "top_factor": c["top_factor_1"],
            "top_factor_weight": float(c["top_factor_1_weight"]) if c.get("top_factor_1_weight") else None,
            "score_delta": score_delta,
            "is_trending": score_delta > 0.08,
            "crrall": crrall,
            "score_updated_at": c.get("score_updated_at"),
        })
    
    return {
        "counties": formatted,
        "total": len(formatted),
        "filters_applied": {
            "state": state,
            "risk_factor": risk_factor,
            "crrall_range": [crrall_min, crrall_max] if crrall_min or crrall_max else None,
            "trending_only": trending_only,
        },
        "lineage": [
            "census_operations_demo.operations.anomaly_scores",
            "census_operations_demo.operations.root_cause_join",
        ],
    }


@router.get("/tracts/{county_fips}")
async def get_county_tracts(
    county_fips: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get tract-level response rate data for a county.
    
    Tries Unity Catalog first; falls back to census_data parquet files.
    """
    state_fips = county_fips[:2]
    county_3digit = county_fips[2:]

    # Try UC first
    uc_tracts = []
    try:
        uc_tracts = get_tracts_for_county(county_fips)
    except Exception as e:
        print(f"UC tract fetch failed for {county_fips}: {e}")

    if uc_tracts:
        county_name = uc_tracts[0].get("county_name", "")
        state_abbr = uc_tracts[0].get("state_abbr", "")
        formatted = []
        for t in uc_tracts:
            formatted.append({
                "tract_fips": t["tract_fips"],
                "tract_name": t["tract_name"],
                "county_fips": county_fips,
                "crrall": float(t["crrall"]) if t.get("crrall") else None,
                "crrall_2010": float(t["crrall_2010"]) if t.get("crrall_2010") else None,
                "delta": float(t["delta"]) if t.get("delta") else None,
            })
        lineage = ["census_operations_demo.operations.tract_response_history"]
    else:
        # Fall back to census_data parquet files
        raw_tracts = get_tract_data(state_fips, county_3digit, limit=200)
        # Get county name from county dataset
        county_rows = get_county_data(state_fips)
        matched = next((c for c in county_rows if c["geography_id"] == county_fips), None)
        county_name = matched["geography"] if matched else f"County {county_fips}"
        state_abbr = ""
        formatted = []
        for t in raw_tracts:
            crrall = t.get("self_response_rate")
            formatted.append({
                "tract_fips": t["geography_id"],
                "tract_name": t["geography"],
                "county_fips": county_fips,
                "crrall": crrall,
                "crrall_2010": None,
                "delta": None,
            })
        lineage = ["census_data/tract_response_parquet"]

    valid_crrall = [t["crrall"] for t in formatted if t["crrall"] is not None]
    county_avg = sum(valid_crrall) / len(valid_crrall) if valid_crrall else None
    worst_tract = min(formatted, key=lambda x: x["crrall"] or 100) if formatted else None

    return {
        "county_fips": county_fips,
        "county_name": county_name,
        "state_abbr": state_abbr,
        "tracts": formatted,
        "summary": {
            "total_tracts": len(formatted),
            "county_avg_crrall": round(county_avg, 1) if county_avg else None,
            "worst_tract_name": worst_tract["tract_name"] if worst_tract else None,
            "worst_tract_crrall": worst_tract["crrall"] if worst_tract else None,
        },
        "lineage": lineage,
    }


@router.get("/counties-by-range")
async def get_counties_in_range(
    crrall_min: float = Query(0),
    crrall_max: float = Query(100),
    limit: int = Query(30),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get ALL counties in a CRRALL range — not limited to high-risk."""
    try:
        counties = get_counties_by_crrall_range(crrall_min, crrall_max, limit)
    except Exception as e:
        print(f"Could not fetch counties by range: {e}")
        counties = []

    formatted = []
    for c in counties:
        risk_score = float(c["risk_score"]) if c.get("risk_score") else None
        score_delta = float(c["score_delta"]) if c.get("score_delta") else None
        crrall = float(c["crrall"]) if c.get("crrall") else None
        formatted.append({
            "county_fips": c["county_fips"],
            "county_name": c["county_name"],
            "state_abbr": c["state_abbr"],
            "risk_score": risk_score,
            "top_factor": c.get("top_factor_1"),
            "top_factor_weight": float(c["top_factor_1_weight"]) if c.get("top_factor_1_weight") else None,
            "score_delta": score_delta,
            "is_trending": (score_delta or 0) > 0.08,
            "crrall": crrall,
            "is_high_risk": (risk_score or 0) > 0.75,
            "score_updated_at": c.get("score_updated_at"),
        })

    return {
        "counties": formatted,
        "total": len(formatted),
        "crrall_range": [crrall_min, crrall_max],
        "lineage": [
            "census_operations_demo.operations.root_cause_join",
            "census_operations_demo.operations.anomaly_scores",
        ],
    }


@router.get("/metric-definitions")
async def get_metric_defs(
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get real metric view definitions from Unity Catalog."""
    try:
        metrics = get_real_metric_views()
    except Exception as e:
        print(f"Could not fetch metric views: {e}")
        metrics = []

    host = get_workspace_host()

    for m in metrics:
        m["databricks_url"] = (
            f"{host}/explore/data/census_operations_demo/operations/{m['view_name']}"
            if host else ""
        )

    return {
        "metrics": metrics,
        "total": len(metrics),
        "workspace_host": host,
        "catalog_url": f"{host}/explore/data/census_operations_demo/operations" if host else "",
    }


@router.get("/composite-metrics")
async def get_composite_metrics_endpoint(
    version: int | None = Query(None, description="Delta table version (VERSION AS OF). Omit for current."),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get composite analytics computed from root_cause_join, with optional Delta time travel."""
    try:
        result = get_composite_metrics(version=version)
        host = get_workspace_host()
        result["workspace_host"] = host
        result["source_table_url"] = (
            f"{host}/explore/data/census_operations_demo/operations/root_cause_join"
            if host else ""
        )
        return result
    except Exception as e:
        print(f"Composite metrics error: {e}")
        return {"metrics": [], "total_counties": None, "counties_below_60pct": None, "source_table": "", "workspace_host": ""}


@router.get("/metric-grants")
async def get_grants(
    view_name: str | None = Query(None),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get current grants on metric views."""
    try:
        grants = get_metric_grants(view_name)
    except Exception as e:
        print(f"Could not fetch metric grants: {e}")
        grants = []

    host = get_workspace_host()

    return {
        "grants": grants,
        "total": len(grants),
        "workspace_host": host,
    }


@router.post("/metric-grants")
async def create_grant(
    request_body: dict[str, Any],
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Grant SELECT on a metric view to a principal."""
    vn = request_body.get("view_name", "")
    principal = request_body.get("principal", "")
    if not vn or not principal:
        return {"status": "error", "message": "view_name and principal are required"}

    result = grant_metric_access(vn, principal)
    host = get_workspace_host()
    result["databricks_url"] = (
        f"{host}/explore/data/census_operations_demo/operations/{vn}"
        if host else ""
    )
    return result


@router.post("/metric-grants/revoke")
async def revoke_grant(
    request_body: dict[str, Any],
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Revoke SELECT on a metric view from a principal."""
    vn = request_body.get("view_name", "")
    principal = request_body.get("principal", "")
    if not vn or not principal:
        return {"status": "error", "message": "view_name and principal are required"}

    return revoke_metric_access(vn, principal)


@router.get("/county-layer")
async def get_county_layer_endpoint(
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Return all ~3200 counties with all demographic fields for map layers and rich hover tooltips.
    
    Joins root_cause_join + broadband_coverage + anomaly_scores + usps_undeliverable.
    Cached-friendly endpoint — callers should cache this result on the frontend.
    """
    try:
        raw = get_national_county_layer()
        counties = []
        for row in raw:
            counties.append({
                "county_fips": row.get("county_fips"),
                "county_name": row.get("county_name"),
                "state_abbr": row.get("state_abbr"),
                "crrall": float(row["crrall"]) if row.get("crrall") is not None else None,
                "crrint": float(row["crrint"]) if row.get("crrint") is not None else None,
                "pct_no_broadband": float(row["pct_no_broadband"]) if row.get("pct_no_broadband") is not None else None,
                "pct_undeliverable": float(row["pct_undeliverable"]) if row.get("pct_undeliverable") is not None else None,
                "pct_language_barrier": float(row["pct_language_barrier"]) if row.get("pct_language_barrier") is not None else None,
                "pct_renter": float(row["pct_renter"]) if row.get("pct_renter") is not None else None,
                "risk_score": float(row["risk_score"]) if row.get("risk_score") is not None else None,
                "top_factor": row.get("top_factor"),
                "top_factor_1": row.get("top_factor_1"),
                "score_delta": float(row["score_delta"]) if row.get("score_delta") is not None else None,
                "vacancy_rate": float(row["vacancy_rate"]) if row.get("vacancy_rate") is not None else None,
            })
        return {
            "counties": counties,
            "count": len(counties),
            "lineage": [
                "census_operations_demo.operations.root_cause_join",
                "census_operations_demo.operations.broadband_coverage",
                "census_operations_demo.operations.anomaly_scores",
                "census_operations_demo.operations.usps_undeliverable",
            ],
        }
    except Exception as e:
        return {"error": str(e), "counties": [], "count": 0}


@router.get("/compliance")
async def get_compliance_overview(
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get Title 13/26 compliance overview — classifications, grants, masking, row filters."""
    from server.uc_client import execute_sql as uc_sql

    host = get_workspace_host()

    classification_map = {
        "state_response_rates": {"classification": "TITLE_13_PROTECTED", "sensitivity": "High", "description": "Individual state-level Census response data protected under Title 13, U.S.C."},
        "county_response_rates": {"classification": "TITLE_13_PROTECTED", "sensitivity": "High", "description": "County-level Census response data — aggregated but still subject to Title 13 disclosure rules."},
        "tract_response_history": {"classification": "TITLE_13_PROTECTED", "sensitivity": "Critical", "description": "Tract-level data at risk of re-identification below population thresholds. Title 13 suppression rules apply."},
        "anomaly_scores": {"classification": "DERIVED_INTERNAL", "sensitivity": "Medium", "description": "ML-derived risk scores from Title 13 source data. Internal use only."},
        "root_cause_join": {"classification": "MULTI_SOURCE_FEDERATED", "sensitivity": "High", "description": "Federated join of Census (Title 13), FCC, and USPS data. Governance applies per source."},
        "broadband_coverage": {"classification": "PUBLIC_AGGREGATE", "sensitivity": "Low", "description": "FCC broadband availability data. Publicly available."},
        "usps_undeliverable": {"classification": "AGENCY_RESTRICTED", "sensitivity": "Medium", "description": "USPS address deliverability data shared under inter-agency agreement."},
        "county_demographics": {"classification": "TITLE_13_PROTECTED", "sensitivity": "High", "description": "ACS demographic data — population, race, age, housing. Title 13 protected."},
        "county_language": {"classification": "TITLE_13_PROTECTED", "sensitivity": "High", "description": "Language proficiency data from ACS. Title 13 protected, includes linguistically isolated households."},
        "county_household_relationships": {"classification": "TITLE_13_PROTECTED", "sensitivity": "Critical", "description": "Household structure data — children, guardianship, family type. High re-identification risk."},
        "rag_chunks": {"classification": "PUBLIC_METHODOLOGY", "sensitivity": "Low", "description": "Census methodology document excerpts. Public domain."},
        "state_combined": {"classification": "TITLE_13_PROTECTED", "sensitivity": "High", "description": "Combined Census + ACS state data with response rates and demographics."},
        "county_combined": {"classification": "TITLE_13_PROTECTED", "sensitivity": "High", "description": "Combined Census + ACS county data. Title 13 protected."},
    }

    tables_info = []
    try:
        tables_raw = uc_sql("SHOW TABLES IN census_operations_demo.operations")
        for t in tables_raw:
            name = t.get("tableName", "")
            info = classification_map.get(name, {"classification": "UNCLASSIFIED", "sensitivity": "Low", "description": ""})
            tables_info.append({"table_name": name, "full_name": f"census_operations_demo.operations.{name}", **info})
    except Exception as e:
        print(f"Compliance table list error: {e}")

    grants = []
    try:
        grants = get_metric_grants()
    except Exception:
        pass

    masking_policies = [
        {"policy_name": "title13_tract_suppression", "applied_to": "census_operations_demo.operations.tract_response_history", "column": "crrall_2020", "rule": "CASE WHEN population < 50 THEN NULL ELSE crrall_2020 END", "description": "Suppress tract-level response rates where population is below 50 to prevent re-identification per Title 13 disclosure avoidance."},
        {"policy_name": "title13_pii_mask", "applied_to": "census_operations_demo.operations.county_household_relationships", "column": "children_no_parents", "rule": "CASE WHEN is_member('title13_authorized') THEN children_no_parents ELSE '***' END", "description": "Mask sensitive household structure counts for users not in the title13_authorized group."},
        {"policy_name": "title26_irs_redact", "applied_to": "census_operations_demo.operations.county_combined", "column": "estimated_income_derived", "rule": "CASE WHEN is_member('title26_irs_authorized') THEN value ELSE NULL END", "description": "Redact IRS-derived income estimates. Only accessible to Title 26 authorized analysts."},
    ]

    row_filters = [
        {"filter_name": "title13_minimum_population", "applied_to": "census_operations_demo.operations.tract_response_history", "condition": "population >= 50 OR is_member('title13_authorized')", "description": "Exclude tracts with population below 50 from query results for non-authorized users to prevent statistical re-identification."},
        {"filter_name": "title13_geographic_restriction", "applied_to": "census_operations_demo.operations.county_household_relationships", "condition": "total_children >= 10 OR is_member('title13_authorized')", "description": "Suppress small-count geographies where individual households could be identified."},
    ]

    return {
        "tables": tables_info,
        "total_tables": len(tables_info),
        "grants": grants,
        "masking_policies": masking_policies,
        "row_filters": row_filters,
        "summary": {
            "title_13_tables": len([t for t in tables_info if t["classification"] == "TITLE_13_PROTECTED"]),
            "title_26_tables": 1,
            "public_tables": len([t for t in tables_info if t["classification"] in ("PUBLIC_AGGREGATE", "PUBLIC_METHODOLOGY")]),
            "federated_tables": len([t for t in tables_info if t["classification"] == "MULTI_SOURCE_FEDERATED"]),
            "masking_policies_count": len(masking_policies),
            "row_filters_count": len(row_filters),
        },
        "workspace_host": host,
        "catalog_url": f"{host}/explore/data/census_operations_demo/operations" if host else "",
    }
