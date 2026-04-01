"""Access logging for Title 13/26 auditability."""
import datetime
import logging
import time
from typing import Callable

from fastapi import Request

logger = logging.getLogger("quality_monitoring.audit")

# Paths to skip logging (static assets, health checks)
_SKIP_PREFIXES = ("/assets/", "/favicon")


async def audit_middleware(request: Request, call_next: Callable):
    """Log API access and append to in-memory audit log for demo compliance tab."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    path = request.url.path
    if not path.startswith("/api/"):
        return response
    if any(path.startswith(p) for p in _SKIP_PREFIXES):
        return response

    # Read user/entitlement from request.state (set by get_entitlement_from_request dep)
    email = getattr(request.state, "user_email", None) or "unknown@demo.gov"
    entitlement = getattr(request.state, "entitlement", None)
    entitlement_str = entitlement.value if entitlement else "title_13_and_26"

    logger.info(
        "access user=%s path=%s method=%s status=%s duration_ms=%.2f entitlement=%s",
        email,
        path,
        request.method,
        response.status_code,
        duration_ms,
        entitlement_str,
    )

    # Append to in-memory audit log (imported late to avoid circular import)
    try:
        from server.mock_data import AUDIT_LOG
        full_path = path
        if request.url.query:
            full_path = f"{path}?{request.url.query}"

        AUDIT_LOG.append({
            "timestamp": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "user": email,
            "method": request.method,
            "path": full_path,
            "status": response.status_code,
            "duration_ms": round(duration_ms, 1),
            "entitlement": entitlement_str,
        })

        # Keep bounded to last 200 entries
        if len(AUDIT_LOG) > 200:
            del AUDIT_LOG[0]
    except Exception as exc:
        logger.debug("Audit append failed: %s", exc)

    return response
