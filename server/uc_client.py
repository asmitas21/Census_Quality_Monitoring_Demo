"""Unity Catalog SQL client for querying synthetic data tables."""
import os
from typing import Any
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState

from server.config import get_workspace_client, get_workspace_host


CATALOG = os.environ.get("CENSUS_CATALOG", "census_operations_demo")
SCHEMA = "operations"


def execute_sql(query: str) -> list[dict[str, Any]]:
    """Execute SQL against Unity Catalog via SQL warehouse and return results as list of dicts."""
    warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID")
    if not warehouse_id:
        raise RuntimeError("DATABRICKS_WAREHOUSE_ID not set")
    
    client = get_workspace_client()
    
    response = client.statement_execution.execute_statement(
        warehouse_id=warehouse_id,
        statement=query,
        wait_timeout="30s",
    )
    
    if response.status.state != StatementState.SUCCEEDED:
        error_msg = response.status.error.message if response.status.error else "Unknown error"
        raise RuntimeError(f"SQL execution failed: {error_msg}")
    
    # Convert result to list of dicts
    if not response.manifest or not response.result:
        return []
    
    columns = [col.name for col in response.manifest.schema.columns]
    rows = []
    
    if response.result.data_array:
        for row in response.result.data_array:
            rows.append(dict(zip(columns, row)))
    
    return rows


def get_anomaly_score(county_fips: str) -> dict[str, Any] | None:
    """Get anomaly score for a county from UC."""
    query = f"""
    SELECT 
        county_fips,
        county_name,
        state_abbr,
        risk_score,
        top_factor_1,
        top_factor_1_weight,
        top_factor_2,
        top_factor_2_weight,
        top_factor_3,
        top_factor_3_weight,
        score_updated_at,
        score_24h_ago,
        score_delta
    FROM {CATALOG}.{SCHEMA}.anomaly_scores
    WHERE county_fips = '{county_fips}'
    """
    results = execute_sql(query)
    return results[0] if results else None


def get_root_cause(county_fips: str) -> dict[str, Any] | None:
    """Get root cause analysis for a county from UC."""
    query = f"""
    SELECT 
        county_fips,
        county_name,
        state_abbr,
        crrall,
        crrint,
        pct_no_broadband,
        pct_undeliverable,
        pct_spanish_limited_english,
        pct_renter,
        root_cause_rank
    FROM {CATALOG}.{SCHEMA}.root_cause_join
    WHERE county_fips = '{county_fips}'
    """
    results = execute_sql(query)
    return results[0] if results else None


def get_time_travel_data(county_fips: str) -> list[dict[str, Any]]:
    """Get tract-level 2010 vs 2020 comparison for a county."""
    query = f"""
    SELECT 
        tract_fips,
        county_fips,
        tract_name,
        county_name,
        state_abbr,
        crrall_2010,
        crrall_2020,
        delta
    FROM {CATALOG}.{SCHEMA}.tract_response_history
    WHERE county_fips = '{county_fips}'
    ORDER BY delta ASC
    """
    return execute_sql(query)


def get_tracts_for_county(county_fips: str) -> list[dict[str, Any]]:
    """Get tract-level response rates for a county."""
    query = f"""
    SELECT 
        tract_fips,
        county_fips,
        tract_name,
        county_name,
        state_abbr,
        crrall_2020 as crrall,
        crrall_2010,
        delta
    FROM {CATALOG}.{SCHEMA}.tract_response_history
    WHERE county_fips = '{county_fips}'
    ORDER BY crrall_2020 ASC
    """
    return execute_sql(query)


def get_usps_data(county_fips: str) -> dict[str, Any] | None:
    """Get USPS undeliverable data for a county."""
    query = f"""
    SELECT 
        county_fips,
        county_name,
        state_abbr,
        pct_undeliverable,
        vacancy_rate
    FROM {CATALOG}.{SCHEMA}.usps_undeliverable
    WHERE county_fips = '{county_fips}'
    """
    results = execute_sql(query)
    return results[0] if results else None


def get_broadband_data(county_fips: str) -> dict[str, Any] | None:
    """Get broadband coverage data for a county."""
    query = f"""
    SELECT 
        county_fips,
        county_name,
        state_abbr,
        pct_no_broadband
    FROM {CATALOG}.{SCHEMA}.broadband_coverage
    WHERE county_fips = '{county_fips}'
    """
    results = execute_sql(query)
    return results[0] if results else None


def get_top_risk_counties(limit: int = 10) -> list[dict[str, Any]]:
    """Get top counties by risk score."""
    query = f"""
    SELECT 
        county_fips,
        county_name,
        state_abbr,
        risk_score,
        top_factor_1,
        score_delta
    FROM {CATALOG}.{SCHEMA}.anomaly_scores
    ORDER BY risk_score DESC
    LIMIT {limit}
    """
    return execute_sql(query)


def get_high_risk_counties(min_risk_score: float = 0.75, limit: int = 10) -> list[dict[str, Any]]:
    """Get counties with risk_score above threshold, joined with root_cause for crrall."""
    query = f"""
    SELECT 
        a.county_fips,
        a.county_name,
        a.state_abbr,
        a.risk_score,
        a.top_factor_1,
        a.top_factor_1_weight,
        a.score_delta,
        a.score_updated_at,
        r.crrall
    FROM {CATALOG}.{SCHEMA}.anomaly_scores a
    LEFT JOIN {CATALOG}.{SCHEMA}.root_cause_join r ON a.county_fips = r.county_fips
    WHERE a.risk_score > {min_risk_score}
    ORDER BY a.risk_score DESC
    LIMIT {limit}
    """
    return execute_sql(query)


def get_counties_with_root_cause(root_cause: str, limit: int = 10) -> list[dict[str, Any]]:
    """Get counties with a specific root cause pattern."""
    query = f"""
    SELECT 
        county_fips,
        county_name,
        state_abbr,
        crrall,
        root_cause_rank,
        pct_no_broadband,
        pct_undeliverable,
        pct_spanish_limited_english
    FROM {CATALOG}.{SCHEMA}.root_cause_join
    WHERE root_cause_rank LIKE '%{root_cause}%'
    ORDER BY crrall ASC
    LIMIT {limit}
    """
    return execute_sql(query)


def get_rag_chunks_for_county(county_fips: str) -> list[dict[str, Any]]:
    """Get RAG methodology chunks for a county via rag_mappings join."""
    # First get the chunk IDs for this county
    mapping_query = f"""
    SELECT chunk_ids
    FROM {CATALOG}.{SCHEMA}.rag_mappings
    WHERE county_fips = '{county_fips}'
    """
    mappings = execute_sql(mapping_query)
    
    if not mappings or not mappings[0].get("chunk_ids"):
        return []
    
    # Parse comma-separated chunk IDs
    chunk_ids = [c.strip() for c in mappings[0]["chunk_ids"].split(",")]
    
    # Fetch the chunks
    chunk_ids_sql = ", ".join([f"'{cid}'" for cid in chunk_ids])
    chunks_query = f"""
    SELECT id, source_doc, section_title, text
    FROM {CATALOG}.{SCHEMA}.rag_chunks
    WHERE id IN ({chunk_ids_sql})
    """
    return execute_sql(chunks_query)


def get_state_risk_scores(state_abbr: str) -> dict[str, dict[str, Any]]:
    """Get all anomaly scores for counties in a state, keyed by county_fips."""
    query = f"""
    SELECT 
        county_fips,
        county_name,
        risk_score,
        top_factor_1,
        score_delta
    FROM {CATALOG}.{SCHEMA}.anomaly_scores
    WHERE state_abbr = '{state_abbr}'
    """
    results = execute_sql(query)
    return {r["county_fips"]: r for r in results}


def get_state_counties_enhanced(state_fips: str) -> list[dict[str, Any]]:
    """Get all counties for a state with CRRALL, CRRINT from root_cause_join."""
    query = f"""
    SELECT 
        county_fips,
        county_name,
        state_abbr,
        crrall,
        crrint,
        pct_no_broadband,
        pct_undeliverable,
        pct_spanish_limited_english,
        pct_renter,
        root_cause_rank
    FROM {CATALOG}.{SCHEMA}.root_cause_join
    WHERE county_fips LIKE '{state_fips}%'
    ORDER BY crrall ASC
    """
    return execute_sql(query)


def get_all_counties_for_histogram() -> list[dict[str, Any]]:
    """Get all county CRRALL values for histogram distribution."""
    query = f"""
    SELECT 
        county_fips,
        crrall
    FROM {CATALOG}.{SCHEMA}.root_cause_join
    ORDER BY crrall ASC
    """
    return execute_sql(query)


def get_scatterplot_data() -> list[dict[str, Any]]:
    """Get federated join of root_cause_join + broadband_coverage + anomaly_scores for scatterplots."""
    query = f"""
    SELECT 
        r.county_fips,
        r.county_name,
        r.state_abbr,
        r.crrall,
        r.crrint,
        r.pct_spanish_limited_english,
        b.pct_no_broadband,
        a.risk_score,
        a.top_factor_1
    FROM {CATALOG}.{SCHEMA}.root_cause_join r
    LEFT JOIN {CATALOG}.{SCHEMA}.broadband_coverage b ON r.county_fips = b.county_fips
    LEFT JOIN {CATALOG}.{SCHEMA}.anomaly_scores a ON r.county_fips = a.county_fips
    """
    return execute_sql(query)


def get_filter_options() -> dict[str, list[str]]:
    """Get distinct states and risk factors for filter dropdowns."""
    states_query = f"""
    SELECT DISTINCT state_abbr
    FROM {CATALOG}.{SCHEMA}.root_cause_join
    ORDER BY state_abbr
    """
    factors_query = f"""
    SELECT DISTINCT top_factor_1
    FROM {CATALOG}.{SCHEMA}.anomaly_scores
    WHERE top_factor_1 IS NOT NULL
    ORDER BY top_factor_1
    """
    states = execute_sql(states_query)
    factors = execute_sql(factors_query)
    
    return {
        "states": [s["state_abbr"] for s in states if s.get("state_abbr")],
        "factors": [f["top_factor_1"] for f in factors if f.get("top_factor_1")],
    }


def get_high_risk_counties_filtered(
    min_risk_score: float = 0.75,
    limit: int = 20,
    state: str | None = None,
    risk_factor: str | None = None,
    crrall_min: float | None = None,
    crrall_max: float | None = None,
    trending_only: bool = False,
) -> list[dict[str, Any]]:
    """Get counties with risk_score above threshold with optional filters."""
    conditions = [f"a.risk_score > {min_risk_score}"]
    
    if state:
        conditions.append(f"a.state_abbr = '{state}'")
    if risk_factor:
        conditions.append(f"a.top_factor_1 = '{risk_factor}'")
    if crrall_min is not None:
        conditions.append(f"r.crrall >= {crrall_min}")
    if crrall_max is not None:
        conditions.append(f"r.crrall < {crrall_max}")
    if trending_only:
        conditions.append("a.score_delta > 0.08")
    
    where_clause = " AND ".join(conditions)
    
    query = f"""
    SELECT 
        a.county_fips,
        a.county_name,
        a.state_abbr,
        a.risk_score,
        a.top_factor_1,
        a.top_factor_1_weight,
        a.score_delta,
        a.score_updated_at,
        r.crrall
    FROM {CATALOG}.{SCHEMA}.anomaly_scores a
    LEFT JOIN {CATALOG}.{SCHEMA}.root_cause_join r ON a.county_fips = r.county_fips
    WHERE {where_clause}
    ORDER BY a.risk_score DESC
    LIMIT {limit}
    """
    return execute_sql(query)


def get_counties_by_crrall_range(
    crrall_min: float,
    crrall_max: float,
    limit: int = 30,
) -> list[dict[str, Any]]:
    """Get ALL counties in a CRRALL range (not just high-risk), sorted worst first."""
    query = f"""
    SELECT 
        r.county_fips,
        r.county_name,
        r.state_abbr,
        r.crrall,
        a.risk_score,
        a.top_factor_1,
        a.top_factor_1_weight,
        a.score_delta,
        a.score_updated_at
    FROM {CATALOG}.{SCHEMA}.root_cause_join r
    LEFT JOIN {CATALOG}.{SCHEMA}.anomaly_scores a ON r.county_fips = a.county_fips
    WHERE r.crrall >= {crrall_min} AND r.crrall < {crrall_max}
    ORDER BY r.crrall ASC
    LIMIT {limit}
    """
    return execute_sql(query)


METRIC_VIEWS = [
    "census_response_metrics",
    "census_risk_metrics",
    "census_composite_metrics",
]

METRIC_VIEW_QUERIES: dict[str, dict[str, Any]] = {
    "census_response_metrics": {
        "measures": ["`Avg Self-Response Rate`", "`Min Self-Response Rate`", "`Max Self-Response Rate`", "`County Count`", "`Avg Internet Response Rate`"],
        "category": "response_rate",
        "coverage": "3,142 US counties · 50 states + DC",
        "grain": "County",
        "source_note": "Aggregated from tract-level census self-response history",
    },
    "census_risk_metrics": {
        "measures": ["`Avg Risk Score`", "`High Risk Count`", "`Max Score Delta`", "`County Count`"],
        "category": "ai_model",
        "coverage": "County-level ML inference · Batch-scored via Databricks Model Serving",
        "grain": "County",
        "source_note": "Risk scores generated offline by XGBoost model, stored in Unity Catalog, read here at query time",
    },
    # census_composite_metrics is registered in UC but MEASURE() requires DDL compilation.
    # We show the definition and metadata; live values are computed via direct SQL below.
    "census_composite_metrics": {
        "measures": [],  # MEASURE() not yet queryable — skip live stats, show YAML only
        "category": "composite",
        "coverage": "3,208 US counties · 50 states + DC · 2020 Census + FCC + USPS + ACS",
        "grain": "County",
        "source_note": (
            "Five weighted composite enumeration-difficulty indicators computed from root_cause_join. "
            "Registered in Unity Catalog — query with MEASURE() once DDL compilation is supported."
        ),
    },
}


def get_real_metric_views() -> list[dict[str, Any]]:
    """Get real metric view definitions from UC via DESCRIBE EXTENDED."""
    results = []
    # census_composite_metrics is registered in UC but DESCRIBE EXTENDED fails with
    # INTERNAL_ERROR because the compiled Spark plan is not populated (REST API limitation).
    # It is shown separately in the frontend via the compositeUcEntry card.
    SKIP_DESCRIBE = {"census_composite_metrics"}

    for view_name in METRIC_VIEWS:
        full_name = f"{CATALOG}.{SCHEMA}.{view_name}"

        if view_name in SKIP_DESCRIBE:
            # Still include a minimal stub so the frontend card renders
            view_config = METRIC_VIEW_QUERIES.get(view_name, {})
            results.append({
                "view_name": view_name,
                "full_name": full_name,
                "comment": view_config.get("source_note", ""),
                "owner": "",
                "created_time": "",
                "source_table": f"{CATALOG}.{SCHEMA}.root_cause_join",
                "view_text": "",
                "dimensions": [
                    {"name": "State", "data_type": "string", "comment": ""},
                    {"name": "County Name", "data_type": "string", "comment": ""},
                    {"name": "County FIPS", "data_type": "string", "comment": ""},
                ],
                "measures": [
                    {"name": m, "data_type": "double", "comment": ""}
                    for m in [
                        "Hard-to-Count Index", "Digital Self-Response Gap",
                        "Multilingual Outreach Priority", "Physical Access Barrier Index",
                        "Paper / Phone Dependence Rate",
                    ]
                ],
                "category": view_config.get("category", "composite"),
                "coverage": view_config.get("coverage", ""),
                "grain": view_config.get("grain", ""),
                "source_note": view_config.get("source_note", ""),
                "live_stats": {},
            })
            continue

        try:
            desc = execute_sql(f"DESCRIBE EXTENDED {full_name}")
        except Exception as e:
            print(f"Could not describe {full_name}: {e}")
            continue

        columns = []
        dimensions = []
        measures = []
        comment = ""
        view_text = ""
        owner = ""
        created_time = ""
        source_table = ""

        in_detail = False
        for row in desc:
            col = row.get("col_name", "")
            dtype = row.get("data_type", "")
            cmt = row.get("comment", "")

            if col == "# Detailed Table Information":
                in_detail = True
                continue

            if in_detail:
                if col == "Comment":
                    comment = dtype
                elif col == "Owner":
                    owner = dtype
                elif col == "Created Time":
                    created_time = dtype
                elif col == "View Text":
                    view_text = dtype
                elif col == "Table Properties":
                    for prop in dtype.split(","):
                        prop = prop.strip().strip("[]")
                        if prop.startswith("metric_view.from.name="):
                            source_table = prop.split("=", 1)[1]
            elif col and dtype:
                entry = {"name": col, "data_type": dtype, "comment": cmt}
                columns.append(entry)
                if "measure" in dtype:
                    measures.append(entry)
                else:
                    dimensions.append(entry)

        # Query live stats
        view_config = METRIC_VIEW_QUERIES.get(view_name, {})
        measure_names = view_config.get("measures", [])
        live_stats: dict[str, Any] = {}
        if measure_names:
            def _safe_alias(m: str) -> str:
                return m.strip("`").replace(" ", "_").replace("-", "_").replace("/", "_").lower()
            select_cols = ", ".join([f"MEASURE({m}) AS {_safe_alias(m)}" for m in measure_names])
            try:
                stats = execute_sql(f"SELECT {select_cols} FROM {full_name}")
                if stats:
                    live_stats = stats[0]
            except Exception as e:
                print(f"Could not query {full_name}: {e}")

        results.append({
            "view_name": view_name,
            "full_name": full_name,
            "comment": comment,
            "owner": owner,
            "created_time": created_time,
            "source_table": source_table,
            "view_text": view_text,
            "dimensions": dimensions,
            "measures": measures,
            "category": view_config.get("category", "general"),
            "coverage": view_config.get("coverage", ""),
            "grain": view_config.get("grain", ""),
            "source_note": view_config.get("source_note", ""),
            "live_stats": live_stats,
        })

    return results


# ---------------------------------------------------------------------------
# Composite Analytics — computed directly from root_cause_join via live SQL
# ---------------------------------------------------------------------------

# Delta versions with human-readable context for the Census statistician
DELTA_VERSIONS = {
    0: {
        "label": "Anomaly Counties Only",
        "description": "Initial flagged dataset — 20 counties identified by the risk model as statistically anomalous. Represents the highest-priority enumeration targets before national data was joined.",
        "counties": 20,
        "vintage": "2020 Census CRRALL",
    },
    1: {
        "label": "Full National (Current)",
        "description": "Complete national county dataset — all 3,142 counties across 50 states + DC. Broadband (FCC), postal delivery (USPS), and language barrier data joined to response history.",
        "counties": 3208,
        "vintage": "2020 Census CRRALL + FCC + USPS",
    },
}

COMPOSITE_METRICS = [
    {
        "name": "Hard-to-Count Index",
        "alias": "hard_to_count_index",
        "formula": "AVG(0.30 * (100 - crrall) + 0.25 * pct_no_broadband + 0.25 * pct_spanish_limited_english + 0.20 * pct_renter)",
        "per_county_expr": "0.30 * (100 - crrall) + 0.25 * pct_no_broadband + 0.25 * pct_spanish_limited_english + 0.20 * pct_renter",
        "tiers": [
            {"label": "Low", "max": 20, "color": "green"},
            {"label": "Moderate", "max": 35, "color": "yellow"},
            {"label": "High", "max": 50, "color": "orange"},
            {"label": "Critical", "max": 100, "color": "red"},
        ],
        "headline_template": "{high_count} counties have significant enumeration barriers and need prioritized NRFU scheduling.",
        "why": "Combines four barriers — low self-response history, no broadband, language isolation, and renter instability — into a single score. Counties scoring higher face compounding obstacles that standard outreach cannot overcome.",
        "doc_link": {"label": "2020 Census Operational Plan", "pdf": "2020_census_methodology.pdf"},
        "uc_columns": ["crrall", "pct_no_broadband", "pct_spanish_limited_english", "pct_renter"],
        "inputs": [
            {"col": "crrall", "label": "Self-Response Rate", "weight": "30%", "source": "2020 Census"},
            {"col": "pct_no_broadband", "label": "No Broadband Access", "weight": "25%", "source": "FCC"},
            {"col": "pct_spanish_limited_english", "label": "Limited English HH", "weight": "25%", "source": "ACS"},
            {"col": "pct_renter", "label": "Renter-Occupied Housing", "weight": "20%", "source": "ACS"},
        ],
        "yaml_measure": (
            "  - name: Hard-to-Count Index\n"
            "    expr: AVG(0.30*(100-crrall) + 0.25*pct_no_broadband\n"
            "              + 0.25*pct_spanish_limited_english + 0.20*pct_renter)\n"
            "    comment: NRFU resource-allocation index (0=easy, 100=hardest)"
        ),
        "color": "red",
    },
    {
        "name": "Digital Self-Response Gap",
        "alias": "digital_divide_score",
        "formula": "AVG(pct_no_broadband * (crrall - crrint) / 100.0)",
        "per_county_expr": "pct_no_broadband * (crrall - crrint) / 100.0",
        "tiers": [
            {"label": "Low", "max": 2, "color": "green"},
            {"label": "Moderate", "max": 5, "color": "yellow"},
            {"label": "High", "max": 10, "color": "orange"},
            {"label": "Critical", "max": 100, "color": "red"},
        ],
        "headline_template": "{high_count} counties cannot rely on internet self-response and need expanded paper and phone options.",
        "why": "Where broadband is unavailable and people can't respond online, response rates drop. This identifies counties where lack of internet access is measurably suppressing participation.",
        "doc_link": {"label": "2020 Census Operational Plan", "pdf": "2020_census_methodology.pdf"},
        "uc_columns": ["pct_no_broadband", "crrall", "crrint"],
        "inputs": [
            {"col": "pct_no_broadband", "label": "No Broadband Access", "weight": "—", "source": "FCC"},
            {"col": "crrall", "label": "All-Mode Response Rate", "weight": "—", "source": "2020 Census"},
            {"col": "crrint", "label": "Internet-Only Response Rate", "weight": "—", "source": "2020 Census"},
        ],
        "yaml_measure": (
            "  - name: Digital Self-Response Gap\n"
            "    expr: AVG(pct_no_broadband * (crrall - crrint) / 100.0)\n"
            "    comment: Broadband-weighted internet response suppression index"
        ),
        "color": "blue",
    },
    {
        "name": "Multilingual Outreach Priority",
        "alias": "multilingual_priority",
        "formula": "AVG(pct_spanish_limited_english * (100.0 - crrall) / 100.0)",
        "per_county_expr": "pct_spanish_limited_english * (100.0 - crrall) / 100.0",
        "tiers": [
            {"label": "Low", "max": 2, "color": "green"},
            {"label": "Moderate", "max": 5, "color": "yellow"},
            {"label": "High", "max": 10, "color": "orange"},
            {"label": "Critical", "max": 100, "color": "red"},
        ],
        "headline_template": "{high_count} counties need bilingual enumerators and multilingual questionnaires this cycle.",
        "why": "Where limited-English households are concentrated in areas with low self-response, standard English-language outreach isn't reaching people. These counties need targeted multilingual support.",
        "doc_link": {"label": "2020 Census Operational Plan", "pdf": "2020_census_methodology.pdf"},
        "uc_columns": ["pct_spanish_limited_english", "crrall"],
        "inputs": [
            {"col": "pct_spanish_limited_english", "label": "Limited English HH", "weight": "—", "source": "ACS"},
            {"col": "crrall", "label": "Self-Response Rate", "weight": "—", "source": "2020 Census"},
        ],
        "yaml_measure": (
            "  - name: Multilingual Outreach Priority\n"
            "    expr: AVG(pct_spanish_limited_english * (100.0 - crrall) / 100.0)\n"
            "    comment: Language-barrier × response-shortfall interaction for bilingual targeting"
        ),
        "color": "purple",
    },
    {
        "name": "Physical Access Barrier",
        "alias": "infra_barrier_index",
        "formula": "AVG((pct_undeliverable + pct_no_broadband) / 2.0)",
        "per_county_expr": "(pct_undeliverable + pct_no_broadband) / 2.0",
        "tiers": [
            {"label": "Low", "max": 10, "color": "green"},
            {"label": "Moderate", "max": 20, "color": "yellow"},
            {"label": "High", "max": 35, "color": "orange"},
            {"label": "Critical", "max": 100, "color": "red"},
        ],
        "headline_template": "{high_count} counties cannot be reached by mail or internet — only in-person enumeration is viable.",
        "why": "When both USPS delivery and broadband are unavailable, neither mailed questionnaires nor online response can reach households. Only enumerator visits work.",
        "doc_link": {"label": "2020 Census Operational Plan", "pdf": "2020_census_methodology.pdf"},
        "uc_columns": ["pct_undeliverable", "pct_no_broadband"],
        "inputs": [
            {"col": "pct_undeliverable", "label": "USPS Undeliverable Rate", "weight": "50%", "source": "USPS"},
            {"col": "pct_no_broadband", "label": "No Broadband Access", "weight": "50%", "source": "FCC"},
        ],
        "yaml_measure": (
            "  - name: Physical Access Barrier Index\n"
            "    expr: AVG((pct_undeliverable + pct_no_broadband) / 2.0)\n"
            "    comment: USPS + broadband barrier average — flags NRFU-only counties"
        ),
        "color": "orange",
    },
    {
        "name": "Paper / Phone Dependence",
        "alias": "mode_gap",
        "formula": "AVG(crrall - crrint)",
        "per_county_expr": "crrall - crrint",
        "tiers": [
            {"label": "Low", "max": 5, "color": "green"},
            {"label": "Moderate", "max": 12, "color": "yellow"},
            {"label": "High", "max": 20, "color": "orange"},
            {"label": "Critical", "max": 100, "color": "red"},
        ],
        "headline_template": "{high_count} counties have high paper/phone response volume requiring additional processing capacity.",
        "why": "The gap between all-mode and internet-only response tells you how many people responded by paper, phone, or drop-box. Higher gaps mean more physical scanning and call-center work.",
        "doc_link": {"label": "2020 Census Operational Plan", "pdf": "2020_census_methodology.pdf"},
        "uc_columns": ["crrall", "crrint"],
        "inputs": [
            {"col": "crrall", "label": "All-Mode Response Rate", "weight": "—", "source": "2020 Census"},
            {"col": "crrint", "label": "Internet-Only Response Rate", "weight": "—", "source": "2020 Census"},
        ],
        "yaml_measure": (
            "  - name: Paper / Phone Dependence Rate\n"
            "    expr: AVG(crrall - crrint)\n"
            "    comment: Percentage-point gap between all-mode and internet-only response"
        ),
        "color": "green",
    },
]


VOLUMES_BROWSE_PATH = "explore/data/volumes/census_operations_demo/operations/census_documents"


def get_composite_metrics(version: int | None = None) -> dict[str, Any]:
    """Compute composite analytics from root_cause_join, optionally at a Delta version."""
    base_table = f"{CATALOG}.{SCHEMA}.root_cause_join"
    source = f"{base_table} VERSION AS OF {version}" if version is not None else base_table

    # --- National aggregate query ---
    agg_parts = [f"ROUND({m['formula']}, 2) AS {m['alias']}" for m in COMPOSITE_METRICS]
    agg_parts.append("COUNT(CASE WHEN crrall < 60 THEN 1 END) AS counties_below_60pct")
    agg_parts.append("COUNT(DISTINCT county_fips) AS total_counties")
    agg_parts.append("COUNT(DISTINCT state_abbr) AS total_states")
    agg_sql = f"SELECT {', '.join(agg_parts)} FROM {source}"

    try:
        rows = execute_sql(agg_sql)
        live_values = rows[0] if rows else {}
    except Exception as e:
        print(f"Composite metrics agg query failed: {e}")
        live_values = {}

    # --- Distribution stats (min, max, p25, p75) per metric ---
    dist_parts: list[str] = []
    for m in COMPOSITE_METRICS:
        expr = m["per_county_expr"]
        alias = m["alias"]
        dist_parts += [
            f"ROUND(MIN({expr}), 2) AS {alias}_min",
            f"ROUND(MAX({expr}), 2) AS {alias}_max",
            f"ROUND(PERCENTILE({expr}, 0.25), 2) AS {alias}_p25",
            f"ROUND(PERCENTILE({expr}, 0.75), 2) AS {alias}_p75",
        ]
    dist_sql = f"SELECT {', '.join(dist_parts)} FROM {source}"

    dist_values: dict[str, Any] = {}
    try:
        dist_rows = execute_sql(dist_sql)
        dist_values = dist_rows[0] if dist_rows else {}
    except Exception as e:
        print(f"Composite metrics dist query failed: {e}")

    # --- Top 5 counties per metric (ranked worst-to-best) ---
    top_counties: dict[str, list[dict[str, Any]]] = {}
    for m in COMPOSITE_METRICS:
        expr = m["per_county_expr"]
        alias = m["alias"]
        top_sql = (
            f"SELECT county_name, state_abbr, ROUND({expr}, 2) AS metric_value "
            f"FROM {source} "
            f"ORDER BY {expr} DESC "
            f"LIMIT 5"
        )
        try:
            top_counties[alias] = execute_sql(top_sql)
        except Exception as e:
            print(f"Top counties query for {alias} failed: {e}")
            top_counties[alias] = []

    # --- Count counties in High + Critical tiers per metric ---
    tier_counts: dict[str, int] = {}
    for m in COMPOSITE_METRICS:
        expr = m["per_county_expr"]
        alias = m["alias"]
        high_threshold = next((t["max"] for t in m["tiers"] if t["label"] == "Moderate"), 0)
        count_sql = f"SELECT COUNT(*) AS n FROM {source} WHERE ({expr}) > {high_threshold}"
        try:
            rows = execute_sql(count_sql)
            tier_counts[alias] = int(rows[0]["n"]) if rows else 0
        except Exception:
            tier_counts[alias] = 0

    ver_key = version if version is not None else max(DELTA_VERSIONS.keys())
    ver_meta = DELTA_VERSIONS.get(ver_key, DELTA_VERSIONS[max(DELTA_VERSIONS.keys())])

    host = get_workspace_host()

    # --- Distinct states for frontend filter ---
    all_states: list[str] = []
    try:
        state_rows = execute_sql(f"SELECT DISTINCT state_abbr FROM {base_table} WHERE state_abbr IS NOT NULL ORDER BY state_abbr")
        all_states = [r["state_abbr"] for r in state_rows if r.get("state_abbr")]
    except Exception:
        pass

    results = []
    for m in COMPOSITE_METRICS:
        alias = m["alias"]
        high_count = tier_counts.get(alias, 0)
        headline = m.get("headline_template", "").format(high_count=high_count) if high_count > 0 else "No counties currently flagged — standard operations are sufficient."
        dl = m.get("doc_link")
        doc_link_url = f"{host}/{VOLUMES_BROWSE_PATH}" if dl and host else None
        results.append({
            **m,
            "live_value": live_values.get(alias),
            "headline": headline,
            "high_count": high_count,
            "source_table": base_table,
            "doc_link": {"label": dl["label"], "url": doc_link_url} if dl and doc_link_url else None,
            "dist": {
                "min": dist_values.get(f"{alias}_min"),
                "max": dist_values.get(f"{alias}_max"),
                "p25": dist_values.get(f"{alias}_p25"),
                "p75": dist_values.get(f"{alias}_p75"),
            },
            "top_counties": top_counties.get(alias, []),
        })

    return {
        "metrics": results,
        "total_counties": live_values.get("total_counties"),
        "total_states": live_values.get("total_states"),
        "counties_below_60pct": live_values.get("counties_below_60pct"),
        "source_table": base_table,
        "all_states": all_states,
        "version": ver_key,
        "version_label": ver_meta["label"],
        "version_description": ver_meta["description"],
        "version_vintage": ver_meta["vintage"],
        "available_versions": [
            {"version": k, "label": v["label"], "description": v["description"], "vintage": v["vintage"]}
            for k, v in sorted(DELTA_VERSIONS.items())
        ],
    }


def get_metric_grants(view_name: str | None = None) -> list[dict[str, Any]]:
    """Get current grants on metric views via SHOW GRANTS."""
    views = [view_name] if view_name else METRIC_VIEWS
    all_grants: list[dict[str, Any]] = []

    for vn in views:
        full_name = f"{CATALOG}.{SCHEMA}.{vn}"
        try:
            grants = execute_sql(f"SHOW GRANTS ON TABLE {full_name}")
            for g in grants:
                all_grants.append({
                    "view_name": vn,
                    "full_name": full_name,
                    "principal": g.get("Principal") or g.get("principal", ""),
                    "action_type": g.get("ActionType") or g.get("action_type", ""),
                    "object_type": g.get("ObjectType") or g.get("object_type", ""),
                })
        except Exception as e:
            print(f"Could not show grants on {full_name}: {e}")

    return all_grants


def grant_metric_access(view_name: str, principal: str) -> dict[str, Any]:
    """Grant SELECT on a metric view to a principal (email)."""
    full_name = f"{CATALOG}.{SCHEMA}.{view_name}"
    try:
        execute_sql(f"GRANT SELECT ON TABLE {full_name} TO `{principal}`")
        return {"status": "granted", "view_name": view_name, "principal": principal}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def revoke_metric_access(view_name: str, principal: str) -> dict[str, Any]:
    """Revoke SELECT on a metric view from a principal (email)."""
    full_name = f"{CATALOG}.{SCHEMA}.{view_name}"
    try:
        execute_sql(f"REVOKE SELECT ON TABLE {full_name} FROM `{principal}`")
        return {"status": "revoked", "view_name": view_name, "principal": principal}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def get_national_county_layer() -> list[dict[str, Any]]:
    """Get all ~3200 counties nationally with full demographic fields for map layers and rich tooltips.
    
    Joins root_cause_join + broadband_coverage + anomaly_scores + usps_undeliverable.
    Returns all demographic factors needed for dynamic map coloring and tooltip display.
    """
    query = f"""
    SELECT
        r.county_fips,
        r.county_name,
        r.state_abbr,
        CAST(r.crrall AS DOUBLE)                    AS crrall,
        CAST(r.crrint AS DOUBLE)                    AS crrint,
        CAST(r.pct_no_broadband AS DOUBLE)          AS pct_no_broadband,
        CAST(r.pct_undeliverable AS DOUBLE)         AS pct_undeliverable,
        CAST(r.pct_spanish_limited_english AS DOUBLE) AS pct_language_barrier,
        CAST(r.pct_renter AS DOUBLE)                AS pct_renter,
        r.root_cause_rank                           AS top_factor,
        CAST(a.risk_score AS DOUBLE)                AS risk_score,
        a.top_factor_1,
        CAST(a.score_delta AS DOUBLE)               AS score_delta,
        CAST(u.vacancy_rate AS DOUBLE)              AS vacancy_rate
    FROM {CATALOG}.{SCHEMA}.root_cause_join r
    LEFT JOIN {CATALOG}.{SCHEMA}.broadband_coverage b
        ON r.county_fips = b.county_fips
    LEFT JOIN {CATALOG}.{SCHEMA}.anomaly_scores a
        ON r.county_fips = a.county_fips
    LEFT JOIN {CATALOG}.{SCHEMA}.usps_undeliverable u
        ON r.county_fips = u.county_fips
    ORDER BY r.state_abbr, r.county_name
    """
    return execute_sql(query)
