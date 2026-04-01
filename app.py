"""Quality Monitoring System — FastAPI app. Serves API and React SPA."""
import os

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.routes import auth_routes, snapshot, anomalies, drilldown, views, export, investigations, ai, audit_routes
from server.config import get_workspace_host

app = FastAPI(title="Quality Monitoring System", description="Census Bureau Quality Monitoring — Databricks App")

from server.audit import audit_middleware
app.middleware("http")(audit_middleware)


@app.get("/api/config")
async def workspace_config():
    """Return runtime workspace info so the frontend can build UC/dashboard links."""
    return {"workspace_host": get_workspace_host()}


app.include_router(auth_routes.router, prefix="/api")
app.include_router(snapshot.router, prefix="/api")
app.include_router(anomalies.router, prefix="/api")
app.include_router(drilldown.router, prefix="/api")
app.include_router(views.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(investigations.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(audit_routes.router, prefix="/api")

frontend_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dir):
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
