"""Audit log viewer for Title 13/26 compliance."""
from typing import Any

from fastapi import APIRouter, Depends, Query

from server.auth import Entitlement, require_auth
from server.mock_data import AUDIT_LOG

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/log")
async def get_audit_log(
    limit: int = Query(50),
    user: str | None = Query(None),
    method: str | None = Query(None),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """View access audit log. Title 13/26 compliance."""
    items = list(AUDIT_LOG)

    # Append recent real requests (from middleware additions)
    if user:
        items = [i for i in items if user.lower() in i.get("user", "").lower()]
    if method:
        items = [i for i in items if i["method"] == method.upper()]

    # Most recent first
    items.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "items": items[:limit],
        "total": len(items),
        "compliance_note": "All API access is logged for Title 13/26 auditability. Logs include user identity, method, path, status, and duration.",
    }
