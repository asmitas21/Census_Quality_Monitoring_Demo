#!/usr/bin/env python3
import subprocess, base64, json, urllib.request, urllib.error, os, sys

HOST = "https://e2-demo-field-eng.cloud.databricks.com"
BASE = "/Workspace/Users/asmita.shah@databricks.com/census-quality-demo"
LOCAL_ROOT = "/Users/asmita.shah/Documents/Demos/Census Bureau Demo/Census_Quality_Monitoring_Demo"
os.chdir(LOCAL_ROOT)

result = subprocess.run(
    ["databricks", "auth", "token", "--host", HOST],
    capture_output=True, text=True
)
if result.returncode != 0:
    print("Error getting token:", result.stderr); sys.exit(1)

token = json.loads(result.stdout)["access_token"]
print("Token acquired:", token[:10] + "...")

def upload(local_path, remote_path):
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    payload = json.dumps({
        "path": remote_path, "format": "RAW", "overwrite": True, "content": content,
    }).encode()
    req = urllib.request.Request(
        HOST + "/api/2.0/workspace/import", data=payload,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            print("  OK:", os.path.basename(local_path))
    except urllib.error.HTTPError as e:
        print("  ERROR:", os.path.basename(local_path), "-", e.read().decode()[:300])

files = [
    ("server/uc_client.py",                               BASE + "/server/uc_client.py"),
    ("frontend/tailwind.config.js",                       BASE + "/frontend/tailwind.config.js"),
    ("frontend/src/screens/MetricViews.tsx",              BASE + "/frontend/src/screens/MetricViews.tsx"),
    ("frontend/dist/index.html",                          BASE + "/frontend/dist/index.html"),
    ("frontend/dist/assets/index-CY505evd.css",           BASE + "/frontend/dist/assets/index-CY505evd.css"),
    ("frontend/dist/assets/index-DGPBgKYY.js",            BASE + "/frontend/dist/assets/index-DGPBgKYY.js"),
]

for local_path, remote_path in files:
    if not os.path.exists(local_path):
        print("  SKIP:", local_path); continue
    print("Uploading", local_path, "...")
    upload(local_path, remote_path)

print("\nAll files uploaded!")
