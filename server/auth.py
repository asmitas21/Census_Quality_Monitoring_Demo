"""Entitlement check and safe-output enforcement. Title 13 vs Title 13+26."""
import functools
import logging
from enum import Enum
from typing import Annotated

from fastapi import Depends, Request

logger = logging.getLogger("quality_monitoring.auth")


class Entitlement(str, Enum):
    TITLE_13_ONLY = "title_13_only"
    TITLE_13_AND_26 = "title_13_and_26"


@functools.lru_cache(maxsize=128)
def _lookup_entitlement(email: str) -> Entitlement:
    """Check real Databricks workspace group membership for this user.
    Cached per email — SDK call only happens once per process lifetime."""
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        users = list(w.users.list(filter=f'userName eq "{email}"', attributes="groups"))
        if users:
            group_names = [g.display for g in (users[0].groups or [])]
            logger.info("User %s groups: %s", email, group_names)
            if "title26_authorized" in group_names:
                return Entitlement.TITLE_13_AND_26
        return Entitlement.TITLE_13_ONLY
    except Exception as exc:
        logger.warning("Group lookup failed for %s (%s) — defaulting to T13+T26", email, exc)
        return Entitlement.TITLE_13_AND_26


def get_entitlement_from_request(request: Request) -> Entitlement:
    """Resolve user entitlement from Databricks Apps injected headers."""
    # Databricks Apps injects X-Forwarded-Email with the authenticated user's email
    email = request.headers.get("X-Forwarded-Email", "").strip()

    if not email:
        # Local dev fallback — give full access
        entitlement = Entitlement.TITLE_13_AND_26
    else:
        entitlement = _lookup_entitlement(email)

    # Store on request.state so audit middleware can read it after call_next
    request.state.user_email = email or "local-dev@demo.gov"
    request.state.entitlement = entitlement
    return entitlement


def require_auth(
    entitlement: Annotated[Entitlement, Depends(get_entitlement_from_request)],
) -> Entitlement:
    """Dependency: ensures user has an entitlement (no 403 for valid app users)."""
    return entitlement
