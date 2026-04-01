"""Save/load view (filters + KPI + benchmark) with rich mock data."""
from typing import Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from server.auth import Entitlement, require_auth
from server.mock_data import SAVED_VIEWS

router = APIRouter(prefix="/views", tags=["views"])

# Mutable copy
_views: dict[str, dict[str, Any]] = dict(SAVED_VIEWS)


class SaveViewRequest(BaseModel):
    name: str
    filters: dict[str, Any]
    kpi_group: str
    benchmark_set: str


@router.post("")
async def save_view(
    body: SaveViewRequest,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Save current view."""
    view_id = f"v{len(_views) + 1}"
    _views[view_id] = {
        "id": view_id,
        "name": body.name,
        "filters": body.filters,
        "kpi_group": body.kpi_group,
        "benchmark_set": body.benchmark_set,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    return _views[view_id]


@router.get("")
async def list_views(
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """List saved views."""
    return {"items": list(_views.values())}


@router.get("/{view_id}")
async def get_view(
    view_id: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get saved view context."""
    if view_id not in _views:
        raise HTTPException(404, "View not found")
    return _views[view_id]


@router.delete("/{view_id}")
async def delete_view(
    view_id: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Delete a saved view."""
    if view_id not in _views:
        raise HTTPException(404, "View not found")
    del _views[view_id]
    return {"deleted": True, "id": view_id}
