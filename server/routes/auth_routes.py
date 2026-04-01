"""Auth and entitlement API for Access Gate."""
from fastapi import APIRouter, Depends

from server.auth import Entitlement, require_auth

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def get_me(entitlement: Entitlement = Depends(require_auth)) -> dict:
    """Return current user entitlement for Access Gate UI."""
    return {
        "entitlement": entitlement.value,
        "label": "Title 13 + Title 26" if entitlement == Entitlement.TITLE_13_AND_26 else "Title 13 only",
    }
