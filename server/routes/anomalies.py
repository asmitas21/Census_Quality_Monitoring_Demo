"""Anomaly list and detail APIs."""
from typing import Any

from fastapi import APIRouter, Depends, Query

from server.auth import Entitlement, require_auth
from server.mock_data import get_anomalies

router = APIRouter(prefix="/anomalies", tags=["anomalies"])


@router.get("")
async def list_anomalies(
    time_window: str = Query("weekly"),
    geography: str | None = Query(None),
    kpi_group: str | None = Query(None),
    benchmark_set: str = Query("2020_census"),
    severity: str | None = Query(None),
    search: str | None = Query(None),
    sort_by: str = Query("severity"),
    sort_dir: str = Query("desc"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """List anomalies with filtering, sorting, and search."""
    items = get_anomalies(
        kpi_group=kpi_group,
        geography=geography,
        severity=severity,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )

    # Mask unsafe items for Title 13 only users
    if entitlement == Entitlement.TITLE_13_ONLY:
        items = [i for i in items if i.get("safe_to_display", True)]

    return {
        "items": items,
        "total": len(items),
        "filters_applied": {
            "kpi_group": kpi_group,
            "geography": geography,
            "severity": severity,
            "search": search,
        },
    }
