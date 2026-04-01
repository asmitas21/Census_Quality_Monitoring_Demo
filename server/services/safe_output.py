"""Aggregation rules and column allowlists by entitlement. Title 13/26 safe output."""
from server.auth import Entitlement

# Columns allowed per entitlement (conceptual; actual lists from policy)
TITLE_13_ONLY_COLUMNS = {"geography_id", "time_window", "kpi_name", "value_agg", "benchmark_value"}
TITLE_13_AND_26_COLUMNS = TITLE_13_ONLY_COLUMNS | {"demographic_segment", "collection_mode"}


def allowed_columns(entitlement: Entitlement) -> set[str]:
    if entitlement == Entitlement.TITLE_13_ONLY:
        return TITLE_13_ONLY_COLUMNS
    return TITLE_13_AND_26_COLUMNS


# Top-level response keys that are always allowed (aggregated data only)
SAFE_TOP_LEVEL_KEYS = {
    "items", "data", "summary", "kpis", "top_anomalies", "hotspots",
    "quality_bands", "last_refreshed", "time_window", "kpi_group",
    "benchmark_set", "total", "filters_applied", "bands", "total_records",
}


def ensure_safe_output(entitlement: Entitlement, payload: dict) -> dict:
    """Filter or validate response so only allowed columns/aggregates are present."""
    allowed = allowed_columns(entitlement)
    if isinstance(payload, dict):
        return {k: v for k, v in payload.items() if k in allowed or k in SAFE_TOP_LEVEL_KEYS}
    return payload
