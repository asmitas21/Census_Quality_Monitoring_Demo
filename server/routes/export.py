"""Export summary, SQL, subscriptions, AI summary."""
from typing import Any
import io
import csv

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from server.auth import Entitlement, require_auth
from server.mock_data import get_kpis, get_anomalies, get_hotspots

router = APIRouter(prefix="/export", tags=["export"])


class SubscribeRequest(BaseModel):
    view_id: str | None = None
    threshold_pct: float = 20.0
    kpi_name: str | None = None


@router.get("/summary", response_model=None)
async def export_summary(
    format: str = Query("csv"),
    time_window: str = Query("weekly"),
    kpi_group: str = Query("quality"),
    entitlement: Entitlement = Depends(require_auth),
):
    """Export safe aggregated summary. Supports CSV format."""
    kpis = get_kpis(kpi_group, time_window)
    anomalies = get_anomalies(kpi_group=kpi_group)
    hotspots = get_hotspots(kpi_group=kpi_group)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Section: KPI Summary"])
        writer.writerow(["KPI", "Value", "Unit", "Benchmark", "Delta %", "Trend"])
        for k in kpis:
            writer.writerow([k["name"], k["value"], k["unit"], k["benchmark"], k["delta_pct"], k["trend"]])

        writer.writerow([])
        writer.writerow(["Section: Anomalies"])
        writer.writerow(["KPI", "Geography", "Delta %", "Severity", "Persistence (weeks)", "Safe to Display"])
        for a in anomalies:
            writer.writerow([a["kpi"], a["geography"], a["delta_pct"], a["severity"], a["persistence_weeks"], a["safe_to_display"]])

        writer.writerow([])
        writer.writerow(["Section: Geography Hotspots"])
        writer.writerow(["Geography", "KPI", "Delta %"])
        for h in hotspots:
            writer.writerow([h["geography"], h["kpi"], h["delta_pct"]])

        return PlainTextResponse(output.getvalue(), media_type="text/csv")

    return {"message": "Use format=csv for download"}


@router.get("/sql")
async def export_sql(
    view_id: str | None = Query(None),
    kpi_group: str = Query("quality"),
    time_window: str = Query("weekly"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Parameterized query template for power users against Unity Catalog."""
    query = """-- Quality Monitoring System — Generated Query
-- Target: Unity Catalog table quality_monitoring.census.quality_snapshot

SELECT
    geography_id,
    geography_name,
    geography_level,
    kpi_name,
    kpi_group,
    value_agg,
    benchmark_value,
    ROUND((value_agg - benchmark_value) / benchmark_value * 100, 2) AS delta_pct,
    CASE
        WHEN ABS((value_agg - benchmark_value) / benchmark_value * 100) > 20 THEN 'high'
        WHEN ABS((value_agg - benchmark_value) / benchmark_value * 100) > 10 THEN 'medium'
        ELSE 'low'
    END AS severity,
    collection_phase,
    time_window
FROM quality_monitoring.census.quality_snapshot
WHERE time_window = :time_window
  AND kpi_group = :kpi_group
ORDER BY ABS(delta_pct) DESC
LIMIT 100;"""

    return {
        "query": query,
        "params": {"time_window": time_window, "kpi_group": kpi_group},
    }


@router.post("/subscriptions")
async def create_subscription(
    body: SubscribeRequest,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Subscribe to threshold breach alerts."""
    return {
        "id": "sub1",
        "threshold_pct": body.threshold_pct,
        "kpi_name": body.kpi_name,
        "view_id": body.view_id,
        "created": True,
        "notification_channel": "email",
    }
