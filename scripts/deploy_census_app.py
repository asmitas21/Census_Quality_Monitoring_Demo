"""
Deploy the Census Quality Monitoring Demo app to any Databricks workspace.

Usage:
    python scripts/deploy_census_app.py --host https://YOUR-WORKSPACE.cloud.databricks.com \\
        --warehouse-id YOUR_WAREHOUSE_ID \\
        [--app-name census-quality-demo] \\
        [--upload-data]

Steps performed:
    1. (Optional) Upload CSV data files to UC staging volume
    2. Upload setup notebook to workspace
    3. Create the Databricks App
    4. Upload app source code to workspace
    5. Deploy the app
    6. Grant the app's service principal UC permissions
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = Path(__file__).parent
DATA_DIR = SCRIPTS_DIR / "data"
CATALOG = "census_operations_demo"
SCHEMA = "operations"

SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".cursor",
             ".databricks", ".ai-dev-kit", ".DS_Store", "scripts"}
SKIP_FILES = {"_upload_changes.py", "capture_pdf_slideover.py", "capture_tabs.py",
              "screenshot_app.py", "census-app-screenshot.png", "investigate-oglala-lakota.png"}


def get_token(host: str) -> str:
    result = subprocess.check_output(
        ["databricks", "auth", "token", "--host", host], text=True
    )
    return json.loads(result)["access_token"]


def api_request(host: str, token: str, method: str, path: str,
                body: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{host}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {error_body}")


def execute_sql(host: str, token: str, warehouse_id: str, stmt: str) -> dict:
    return api_request(host, token, "POST", "/api/2.0/sql/statements", {
        "warehouse_id": warehouse_id,
        "statement": stmt,
        "wait_timeout": "30s",
    })


def upload_workspace_file(host: str, token: str, workspace_path: str, local_path: str) -> bool:
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    try:
        api_request(host, token, "POST", "/api/2.0/workspace/import", {
            "path": workspace_path,
            "format": "AUTO",
            "content": content,
            "overwrite": True,
            "language": "",
        })
        return True
    except Exception as e:
        print(f"    FAILED: {workspace_path}: {e}")
        return False


def mkdirs(host: str, token: str, workspace_path: str):
    try:
        api_request(host, token, "POST", "/api/2.0/workspace/mkdirs",
                     {"path": workspace_path})
    except Exception:
        pass


def upload_to_volume(host: str, token: str, volume_path: str, local_path: str):
    """Upload a file to a UC volume via the Files API."""
    with open(local_path, "rb") as f:
        file_bytes = f.read()
    encoded_path = urllib.parse.quote(volume_path, safe="/")
    url = f"{host}/api/2.0/fs/files{encoded_path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/octet-stream",
    }
    req = urllib.request.Request(url, data=file_bytes, headers=headers, method="PUT")
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print(f"    Volume upload failed for {volume_path}: {e.code} {e.read().decode()[:200]}")
        return False


# ── Step 1: Upload CSV data to staging volume ─────────────────────────────────

def step_upload_data(host: str, token: str, warehouse_id: str):
    print("\n── Step 1: Upload CSV data to staging volume ──")

    execute_sql(host, token, warehouse_id,
                f"CREATE CATALOG IF NOT EXISTS {CATALOG}")
    execute_sql(host, token, warehouse_id,
                f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")
    execute_sql(host, token, warehouse_id,
                f"CREATE VOLUME IF NOT EXISTS {CATALOG}.{SCHEMA}.staging")

    csv_files = sorted(DATA_DIR.glob("*.csv"))
    if not csv_files:
        print(f"  No CSV files found in {DATA_DIR}. Run export_source_data.py first.")
        return False

    for csv_file in csv_files:
        vol_path = f"/Volumes/{CATALOG}/{SCHEMA}/staging/{csv_file.name}"
        size_kb = csv_file.stat().st_size / 1024
        print(f"  Uploading {csv_file.name} ({size_kb:.0f} KB)...", end=" ", flush=True)
        if upload_to_volume(host, token, vol_path, str(csv_file)):
            print("OK")
        else:
            print("FAILED")

    return True


# ── Step 2: Upload setup notebook ─────────────────────────────────────────────

def step_upload_notebook(host: str, token: str, user_email: str):
    print("\n── Step 2: Upload setup notebook ──")
    notebook_path = SCRIPTS_DIR / "setup_census_demo.py"
    ws_path = f"/Users/{user_email}/census-quality-demo-setup/setup_census_demo"

    mkdirs(host, token, f"/Users/{user_email}/census-quality-demo-setup")

    with open(notebook_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()

    api_request(host, token, "POST", "/api/2.0/workspace/import", {
        "path": ws_path,
        "format": "SOURCE",
        "content": content,
        "overwrite": True,
        "language": "PYTHON",
    })
    print(f"  Uploaded notebook to {ws_path}")
    print(f"  Run it on a cluster to create tables and groups.")
    return ws_path


# ── Step 3: Create the Databricks App ─────────────────────────────────────────

def step_create_app(host: str, token: str, app_name: str) -> dict:
    print(f"\n── Step 3: Create app '{app_name}' ──")
    try:
        result = api_request(host, token, "POST", "/api/2.0/apps", {
            "name": app_name,
            "description": "Census Bureau Quality Monitoring Demo",
        })
        sp_name = result.get("service_principal_name", "")
        sp_client_id = result.get("service_principal_client_id", "")
        print(f"  App created: {result.get('name')}")
        print(f"  Service principal: {sp_name} ({sp_client_id})")
        return result
    except RuntimeError as e:
        if "already exists" in str(e):
            print(f"  App '{app_name}' already exists, fetching details...")
            result = api_request(host, token, "GET", f"/api/2.0/apps/{app_name}")
            return result
        raise


# ── Step 4: Upload app source code ────────────────────────────────────────────

def step_upload_code(host: str, token: str, user_email: str, app_name: str,
                     warehouse_id: str):
    print("\n── Step 4: Upload app source code ──")
    ws_root = f"/Users/{user_email}/{app_name}"

    files = []
    for dirpath, dirnames, filenames in os.walk(REPO_ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            if f in SKIP_FILES or f.startswith("."):
                continue
            local_path = os.path.join(dirpath, f)
            rel_path = os.path.relpath(local_path, REPO_ROOT)
            files.append((local_path, rel_path))

    dirs_created = set()
    for _, rel_path in files:
        dir_part = os.path.dirname(rel_path)
        if dir_part and dir_part not in dirs_created:
            mkdirs(host, token, f"{ws_root}/{dir_part}")
            dirs_created.add(dir_part)

    success = 0
    for local_path, rel_path in files:
        ws_path = f"{ws_root}/{rel_path}"
        if upload_workspace_file(host, token, ws_path, local_path):
            success += 1

    print(f"  Uploaded {success}/{len(files)} files to {ws_root}")

    print("  Patching app.yaml with target warehouse ID...")
    app_yaml_content = f"""command:
  - "python"
  - "-m"
  - "uvicorn"
  - "app:app"
  - "--host"
  - "0.0.0.0"
  - "--port"
  - "8000"

env:
  - name: SERVING_ENDPOINT
    value: databricks-claude-sonnet-4-5
  - name: DATABRICKS_WAREHOUSE_ID
    value: "{warehouse_id}"
"""
    app_yaml_b64 = base64.b64encode(app_yaml_content.encode()).decode()
    api_request(host, token, "POST", "/api/2.0/workspace/import", {
        "path": f"{ws_root}/app.yaml",
        "format": "AUTO",
        "content": app_yaml_b64,
        "overwrite": True,
        "language": "",
    })
    print(f"  app.yaml updated with warehouse_id={warehouse_id}")

    return ws_root


# ── Step 5: Deploy the app ────────────────────────────────────────────────────

def step_deploy(host: str, token: str, app_name: str, ws_root: str) -> str:
    print("\n── Step 5: Deploy the app ──")

    print("  Waiting for app compute to be ACTIVE...", flush=True)
    for attempt in range(20):
        app_info = api_request(host, token, "GET", f"/api/2.0/apps/{app_name}")
        compute_state = app_info.get("compute_status", {}).get("state", "")
        if compute_state == "ACTIVE":
            print(f"  Compute is ACTIVE")
            break
        print(f"  Compute state: {compute_state} (attempt {attempt+1}/20)")
        time.sleep(15)
    else:
        print("  WARNING: Compute did not become ACTIVE in time. Trying deploy anyway.")

    result = api_request(host, token, "POST",
                          f"/api/2.0/apps/{app_name}/deployments", {
                              "source_code_path": f"/Workspace{ws_root}",
                              "mode": "SNAPSHOT",
                          })
    deployment_id = result.get("deployment_id", "")
    print(f"  Deployment started: {deployment_id}")

    print("  Waiting for deployment to succeed...", flush=True)
    for attempt in range(30):
        dep_info = api_request(host, token, "GET",
                                f"/api/2.0/apps/{app_name}/deployments/{deployment_id}")
        dep_state = dep_info.get("status", {}).get("state", "")
        dep_msg = dep_info.get("status", {}).get("message", "")
        if dep_state == "SUCCEEDED":
            print(f"  Deployment SUCCEEDED: {dep_msg}")
            return deployment_id
        if dep_state == "FAILED":
            print(f"  Deployment FAILED: {dep_msg}")
            return deployment_id
        print(f"  Status: {dep_state} — {dep_msg} (attempt {attempt+1}/30)")
        time.sleep(10)

    print("  WARNING: Deployment did not complete within timeout.")
    return deployment_id


# ── Step 6: Grant UC permissions ──────────────────────────────────────────────

def step_grant_permissions(host: str, token: str, warehouse_id: str,
                            app_info: dict):
    print("\n── Step 6: Grant UC permissions to app service principal ──")
    sp_client_id = app_info.get("service_principal_client_id", "")
    if not sp_client_id:
        print("  ERROR: Could not find service principal client ID.")
        return

    grants = [
        f"GRANT USE CATALOG ON CATALOG {CATALOG} TO `{sp_client_id}`",
        f"GRANT USE SCHEMA ON SCHEMA {CATALOG}.{SCHEMA} TO `{sp_client_id}`",
        f"GRANT SELECT ON SCHEMA {CATALOG}.{SCHEMA} TO `{sp_client_id}`",
        f"GRANT READ VOLUME ON VOLUME {CATALOG}.{SCHEMA}.census_documents TO `{sp_client_id}`",
    ]

    for stmt in grants:
        result = execute_sql(host, token, warehouse_id, stmt)
        state = result.get("status", {}).get("state", "")
        if state == "SUCCEEDED":
            print(f"  OK: {stmt.split('TO')[0].strip()}")
        else:
            err = result.get("status", {}).get("error", {}).get("message", "")
            print(f"  FAILED: {err[:100]}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Deploy Census Quality Monitoring Demo to a Databricks workspace"
    )
    parser.add_argument("--host", required=True,
                        help="Target workspace URL (e.g. https://my-workspace.cloud.databricks.com)")
    parser.add_argument("--warehouse-id", required=True,
                        help="SQL warehouse ID on the target workspace")
    parser.add_argument("--app-name", default="census-quality-demo",
                        help="Databricks App name (default: census-quality-demo)")
    parser.add_argument("--upload-data", action="store_true",
                        help="Upload CSV data files to staging volume")
    parser.add_argument("--skip-app-create", action="store_true",
                        help="Skip app creation (if already exists)")
    args = parser.parse_args()

    host = args.host.rstrip("/")
    if not host.startswith("https://"):
        host = f"https://{host}"

    print(f"Target workspace: {host}")
    print(f"Warehouse ID:     {args.warehouse_id}")
    print(f"App name:         {args.app_name}")

    token = get_token(host)

    me_resp = api_request(host, token, "GET", "/api/2.0/preview/scim/v2/Me")
    user_email = me_resp.get("userName", "")
    print(f"Authenticated as: {user_email}\n")

    if args.upload_data:
        step_upload_data(host, token, args.warehouse_id)
        notebook_path = step_upload_notebook(host, token, user_email)
        print(f"\n  *** ACTION REQUIRED ***")
        print(f"  Run the notebook at: {notebook_path}")
        print(f"  on a cluster to create UC tables and groups.")
        print(f"  Then re-run this script WITHOUT --upload-data to deploy the app.\n")
        return

    app_info = step_create_app(host, token, args.app_name)
    ws_root = step_upload_code(host, token, user_email, args.app_name,
                                args.warehouse_id)
    step_deploy(host, token, args.app_name, ws_root)
    step_grant_permissions(host, token, args.warehouse_id, app_info)

    app_url = app_info.get("url", "N/A")
    print(f"\n{'=' * 60}")
    print(f"DEPLOYMENT COMPLETE")
    print(f"  App URL: {app_url}")
    print(f"  App name: {args.app_name}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
