"""Investigation tracker CRUD with rich mock data."""
from enum import Enum
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from server.auth import Entitlement, require_auth
from server.mock_data import INVESTIGATIONS

router = APIRouter(prefix="/investigations", tags=["investigations"])


class InvestigationStatus(str, Enum):
    OPEN = "open"
    MONITORING = "monitoring"
    EXPLAINED = "explained"
    ESCALATED = "escalated"
    CLOSED = "closed"


class CreateInvestigationRequest(BaseModel):
    title: str
    view_id: str | None = None
    anomaly_ids: list[str] = []
    notes: str = ""
    assigned_to: str = ""


class UpdateInvestigationRequest(BaseModel):
    status: InvestigationStatus | None = None
    notes: str | None = None
    escalation: bool | None = None
    assigned_to: str | None = None


# Use the rich mock data store (mutable copy)
_investigations: dict[str, dict[str, Any]] = dict(INVESTIGATIONS)


@router.get("")
async def list_investigations(
    status: str | None = Query(None),
    search: str | None = Query(None),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """List investigations with optional status and search filter."""
    items = list(_investigations.values())
    if status:
        items = [i for i in items if i["status"] == status]
    if search:
        s = search.lower()
        items = [i for i in items if s in i["title"].lower() or s in i.get("notes", "").lower()]
    # Sort: escalated first, then by updated_at desc
    items.sort(key=lambda x: (not x.get("escalation", False), x.get("updated_at", "")), reverse=False)
    items.sort(key=lambda x: x.get("escalation", False), reverse=True)
    return {"items": items, "total": len(items)}


@router.post("")
async def create_investigation(
    body: CreateInvestigationRequest,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Create investigation."""
    inv_id = f"inv{len(_investigations) + 1}"
    from datetime import datetime
    now = datetime.utcnow().isoformat() + "Z"
    _investigations[inv_id] = {
        "id": inv_id,
        "title": body.title,
        "status": "open",
        "view_id": body.view_id,
        "anomaly_ids": body.anomaly_ids,
        "notes": body.notes,
        "escalation": False,
        "created_at": now,
        "updated_at": now,
        "assigned_to": body.assigned_to or "Unassigned",
    }
    return _investigations[inv_id]


@router.get("/{investigation_id}")
async def get_investigation(
    investigation_id: str,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Get single investigation."""
    if investigation_id not in _investigations:
        raise HTTPException(404, "Not found")
    return _investigations[investigation_id]


@router.patch("/{investigation_id}")
async def update_investigation(
    investigation_id: str,
    body: UpdateInvestigationRequest,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Update status, notes, escalation, assignment."""
    if investigation_id not in _investigations:
        raise HTTPException(404, "Not found")
    inv = _investigations[investigation_id]
    from datetime import datetime
    if body.status is not None:
        inv["status"] = body.status.value
    if body.notes is not None:
        inv["notes"] = body.notes
    if body.escalation is not None:
        inv["escalation"] = body.escalation
    if body.assigned_to is not None:
        inv["assigned_to"] = body.assigned_to
    inv["updated_at"] = datetime.utcnow().isoformat() + "Z"
    return inv
