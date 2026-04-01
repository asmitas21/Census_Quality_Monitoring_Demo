"""
End-to-end deployment of the Census Quality Monitoring Demo to any Databricks workspace.

Creates all Unity Catalog objects (33 tables, 5 UDFs, 2 governed views, 4 metric views,
tags, groups) and deploys the Databricks App.

Usage:
    python scripts/deploy_full_demo.py \
        --host https://YOUR-WORKSPACE.cloud.databricks.com \
        --warehouse-id YOUR_WAREHOUSE_ID \
        [--profile YOUR_DATABRICKS_PROFILE] \
        [--app-name census-quality-demo]
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = Path(__file__).parent
DATA_DIR = SCRIPTS_DIR / "data"
PDFS_DIR = SCRIPTS_DIR / "pdfs"
CATALOG = "census_operations_demo"
SCHEMA = "operations"
T = f"{CATALOG}.{SCHEMA}"

SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".cursor",
             ".databricks", ".ai-dev-kit", ".DS_Store", "scripts"}
SKIP_FILES = {"_upload_changes.py", "capture_pdf_slideover.py", "capture_tabs.py",
              "screenshot_app.py", "census-app-screenshot.png", "investigate-oglala-lakota.png"}


def get_token(host: str, profile: str | None = None) -> str:
    cmd = ["databricks", "auth", "token", "--host", host]
    if profile:
        cmd += ["-p", profile]
    result = json.loads(
        __import__("subprocess").check_output(cmd, text=True)
    )
    return result["access_token"]


def api_request(host: str, token: str, method: str, path: str,
                body: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{host}{path}", data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {error_body[:500]}")


def run_sql(host: str, token: str, wh: str, sql: str, wait=True) -> tuple[str, str]:
    result = api_request(host, token, "POST", "/api/2.0/sql/statements/", {
        "warehouse_id": wh, "statement": sql, "wait_timeout": "50s"
    })
    state = result.get("status", {}).get("state", "")
    error = result.get("status", {}).get("error", {}).get("message", "")
    if wait and state in ("PENDING", "RUNNING"):
        stmt_id = result.get("statement_id", "")
        for _ in range(60):
            time.sleep(3)
            r = api_request(host, token, "GET", f"/api/2.0/sql/statements/{stmt_id}")
            state = r.get("status", {}).get("state", "")
            if state not in ("PENDING", "RUNNING"):
                error = r.get("status", {}).get("error", {}).get("message", "")
                break
    return state, error


def upload_to_volume(host: str, token: str, vol_path: str, local_path: str) -> bool:
    with open(local_path, "rb") as f:
        file_bytes = f.read()
    encoded = urllib.parse.quote(vol_path, safe="/")
    req = urllib.request.Request(
        f"{host}/api/2.0/fs/files{encoded}", data=file_bytes,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/octet-stream"},
        method="PUT"
    )
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print(f"    Upload failed: {e.code} {e.read().decode()[:200]}")
        return False


def mkdirs(host, token, path):
    try:
        api_request(host, token, "POST", "/api/2.0/workspace/mkdirs", {"path": path})
    except Exception:
        pass


def upload_workspace_file(host, token, ws_path, local_path):
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    try:
        api_request(host, token, "POST", "/api/2.0/workspace/import", {
            "path": ws_path, "format": "AUTO", "content": content,
            "overwrite": True, "language": "",
        })
        return True
    except Exception as e:
        print(f"    FAILED: {ws_path}: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Catalog, Schema, Volumes
# ═══════════════════════════════════════════════════════════════════════════════

def step1_create_catalog(host, token, wh):
    print("\n══ Step 1: Create catalog, schema, and volumes ══")
    for sql in [
        f"CREATE CATALOG IF NOT EXISTS {CATALOG}",
        f"CREATE SCHEMA IF NOT EXISTS {T}",
        f"CREATE VOLUME IF NOT EXISTS {T}.staging",
        f"CREATE VOLUME IF NOT EXISTS {T}.census_documents",
    ]:
        s, e = run_sql(host, token, wh, sql)
        label = sql.split("IF NOT EXISTS")[-1].strip()
        print(f"  {label}: {s} {e[:60] if e else ''}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Upload CSVs and PDFs
# ═══════════════════════════════════════════════════════════════════════════════

def step2_upload_data(host, token):
    print("\n══ Step 2: Upload CSV data and PDF documents ══")

    csv_files = sorted(DATA_DIR.glob("*.csv"))
    print(f"  Found {len(csv_files)} CSV files")
    for f in csv_files:
        vol = f"/Volumes/{T}/staging/{f.name}"
        ok = upload_to_volume(host, token, vol, str(f))
        print(f"    {f.name}: {'OK' if ok else 'FAILED'}")

    if PDFS_DIR.exists():
        pdf_files = sorted(PDFS_DIR.glob("*.pdf"))
        print(f"  Found {len(pdf_files)} PDF files")
        for f in pdf_files:
            vol = f"/Volumes/{T}/census_documents/{f.name}"
            ok = upload_to_volume(host, token, vol, str(f))
            print(f"    {f.name}: {'OK' if ok else 'FAILED'}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Load 11 base tables from CSV
# ═══════════════════════════════════════════════════════════════════════════════

def step3_load_base_tables(host, token, wh):
    print("\n══ Step 3: Load 11 base tables from CSV ══")
    tables = [
        "root_cause_join", "anomaly_scores", "broadband_coverage",
        "usps_undeliverable", "tract_response_history", "rag_chunks",
        "rag_mappings", "genie_examples", "document_chunks",
        "county_combined", "state_combined",
    ]
    for name in tables:
        vol = f"/Volumes/{T}/staging/{name}.csv"
        opts = "header => 'true', inferSchema => 'true', escape => '\"', rescuedDataColumn => '_rescued'"
        sql = f"CREATE OR REPLACE TABLE {T}.{name} AS SELECT * FROM read_files('{vol}', format => 'csv', {opts})"
        s, e = run_sql(host, token, wh, sql)
        print(f"  {name}: {s} {e[:60] if e else ''}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Create 16 derived tables
# ═══════════════════════════════════════════════════════════════════════════════

def step4_create_derived_tables(host, token, wh):
    print("\n══ Step 4: Create 16 derived tables ══")
    derived = {
        "anomaly_scores_v2": f"""
            SELECT *, 'xgboost_v2' AS model_version, CURRENT_TIMESTAMP() AS predicted_at
            FROM {T}.anomaly_scores""",
        "county_census_2010": f"""
            SELECT county_fips, county_name, state_abbr,
                crrall AS total_population_response_rate, crrint AS internet_response_rate,
                crrall * 0.95 AS crrall_2010_estimated, pct_renter, pct_no_broadband
            FROM {T}.root_cause_join
            WHERE state_abbr IN ('TX','CA','NY','FL','PA','IL','OH','GA','NC','MI')""",
        "county_demographics": f"""
            SELECT county_fips, county_name, state_abbr,
                pct_spanish_limited_english AS pct_hispanic,
                pct_renter AS pct_renter_occupied,
                ROUND(100 - pct_renter, 1) AS pct_owner_occupied,
                ROUND(pct_spanish_limited_english * 0.3, 1) AS pct_children_under_5,
                ROUND(pct_renter * 0.85, 1) AS pct_under_18
            FROM {T}.root_cause_join""",
        "county_household_relationships": f"""
            SELECT county_fips, county_name, state_abbr,
                ROUND(100 - pct_renter, 1) AS pct_family_households,
                ROUND(pct_renter * 0.6, 1) AS pct_nonfamily_households,
                ROUND(pct_renter * 0.4, 1) AS pct_living_alone,
                ROUND((100 - pct_renter) * 0.7, 1) AS pct_married_couple
            FROM {T}.root_cause_join""",
        "county_language": f"""
            SELECT county_fips, county_name, state_abbr,
                pct_spanish_limited_english AS pct_limited_english,
                ROUND(pct_spanish_limited_english * 0.7, 1) AS pct_spanish_speaking,
                ROUND(pct_spanish_limited_english * 0.15, 1) AS pct_asian_languages,
                ROUND(pct_spanish_limited_english * 0.15, 1) AS pct_other_languages,
                ROUND(100 - pct_spanish_limited_english, 1) AS pct_english_only
            FROM {T}.root_cause_join WHERE pct_spanish_limited_english > 5""",
        "county_response_rates": f"""
            SELECT county_fips, county_name, state_abbr,
                crrall, crrint, ROUND(crrall - crrint, 1) AS mail_response_rate,
                ROUND(crrall * 0.05, 1) AS phone_response_rate,
                ROUND(crrall * 1.02, 1) AS drrall, root_cause_rank
            FROM {T}.root_cause_join""",
        "county_risk_analysis": f"""
            SELECT r.county_fips, r.county_name, r.state_abbr,
                a.risk_score, a.top_factor_1, a.top_factor_1_weight,
                r.crrall, r.pct_no_broadband, r.pct_undeliverable,
                r.pct_spanish_limited_english, r.pct_renter,
                CASE WHEN a.risk_score > 0.8 THEN 'CRITICAL'
                     WHEN a.risk_score > 0.6 THEN 'HIGH'
                     WHEN a.risk_score > 0.4 THEN 'MODERATE'
                     ELSE 'LOW' END AS risk_tier,
                r.root_cause_rank
            FROM {T}.root_cause_join r JOIN {T}.anomaly_scores a ON r.county_fips = a.county_fips""",
        "census_docs": f"""
            SELECT DISTINCT document_name AS doc_name, document_name AS doc_path,
                REPLACE(REPLACE(document_name, '.pdf', ''), '_', ' ') AS title,
                'Census Bureau' AS source, CURRENT_DATE() AS uploaded_at
            FROM {T}.document_chunks""",
        "pdf_chunks": f"""
            SELECT chunk_id, document_name, content, LENGTH(content) AS chunk_length,
                ROW_NUMBER() OVER (PARTITION BY document_name ORDER BY chunk_id) AS chunk_index
            FROM {T}.document_chunks""",
        "pdf_chunks_embedded": f"""
            SELECT chunk_id, document_name, content, LENGTH(content) AS chunk_length,
                CAST(NULL AS ARRAY<DOUBLE>) AS embedding
            FROM {T}.document_chunks""",
        "state_response_rates": f"""
            SELECT state_abbr, COUNT(*) AS county_count,
                ROUND(AVG(crrall), 1) AS crrall, ROUND(AVG(crrint), 1) AS crrint,
                ROUND(AVG(crrall) * 1.02, 1) AS drrall,
                ROUND(MIN(crrall), 1) AS min_crrall, ROUND(MAX(crrall), 1) AS max_crrall
            FROM {T}.root_cause_join GROUP BY state_abbr""",
        "state_demographics": f"""
            SELECT state_abbr, COUNT(*) AS county_count,
                ROUND(AVG(pct_spanish_limited_english), 1) AS avg_limited_english,
                ROUND(AVG(pct_renter), 1) AS avg_renter,
                ROUND(AVG(pct_no_broadband), 1) AS avg_no_broadband,
                ROUND(AVG(pct_undeliverable), 1) AS avg_undeliverable
            FROM {T}.root_cause_join GROUP BY state_abbr""",
        "tract_demographics": f"""
            SELECT tract_fips, tract_name, county_fips, county_name, state_abbr,
                crrall_2020 AS crrall, ROUND(crrall_2020 * 0.6, 1) AS crrint, delta
            FROM {T}.tract_response_history""",
        "tract_detailed_demographics": f"""
            SELECT t.tract_fips, t.tract_name, t.county_fips, t.county_name, t.state_abbr,
                t.crrall_2010, t.crrall_2020, t.delta,
                r.pct_no_broadband, r.pct_undeliverable, r.pct_spanish_limited_english, r.pct_renter
            FROM {T}.tract_response_history t
            LEFT JOIN {T}.root_cause_join r ON t.county_fips = r.county_fips""",
        "tract_response_rates": f"""
            SELECT tract_fips, tract_name, county_fips, county_name, state_abbr,
                crrall_2010, crrall_2020, ROUND(crrall_2020 * 0.6, 1) AS crrint_2020, delta,
                CASE WHEN delta < -20 THEN 'SEVERE' WHEN delta < -10 THEN 'MODERATE'
                     WHEN delta < 0 THEN 'MILD' ELSE 'IMPROVED' END AS trend_category
            FROM {T}.tract_response_history""",
    }

    # Table with dash in name
    s, e = run_sql(host, token, wh, f"""
        CREATE TABLE IF NOT EXISTS {T}.`census-final-endpoint_payload` (
            request_id STRING, timestamp TIMESTAMP, input_data STRING,
            prediction DOUBLE, model_version STRING)""")
    print(f"  census-final-endpoint_payload: {s} {e[:60] if e else ''}")

    for name, query in derived.items():
        s, e = run_sql(host, token, wh, f"CREATE OR REPLACE TABLE {T}.{name} AS {query}")
        print(f"  {name}: {s} {e[:60] if e else ''}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Create UDFs and governed views
# ═══════════════════════════════════════════════════════════════════════════════

def step5_create_udfs_and_views(host, token, wh):
    print("\n══ Step 5: Create 5 UDFs and 2 governed views ══")

    udfs = {
        "mask_demographic_column": f"""
            CREATE OR REPLACE FUNCTION {T}.mask_demographic_column(value DOUBLE) RETURNS DOUBLE
            RETURN CASE WHEN IS_MEMBER('census_title13_authorized') THEN value ELSE NULL END""",
        "mask_tract_fips": f"""
            CREATE OR REPLACE FUNCTION {T}.mask_tract_fips(value BIGINT) RETURNS BIGINT
            RETURN CASE WHEN IS_MEMBER('census_title13_authorized') THEN value ELSE NULL END""",
        "census_region_filter": f"""
            CREATE OR REPLACE FUNCTION {T}.census_region_filter(state STRING) RETURNS BOOLEAN
            RETURN CASE
                WHEN IS_MEMBER('census_title13_authorized') THEN TRUE
                WHEN IS_MEMBER('census_regional_analysts') THEN state IN ('NY','NJ','CT','MA','ME','NH','VT','RI','PA')
                ELSE TRUE END""",
        "suppress_small_pct": f"""
            CREATE OR REPLACE FUNCTION {T}.suppress_small_pct(value DOUBLE) RETURNS DOUBLE
            RETURN CASE WHEN value IS NOT NULL AND value < 1.0 THEN NULL ELSE value END""",
        "suppress_small_counts": f"""
            CREATE OR REPLACE FUNCTION {T}.suppress_small_counts(value INT) RETURNS INT
            RETURN CASE WHEN value IS NOT NULL AND value < 10 THEN NULL ELSE value END""",
    }

    for name, sql in udfs.items():
        s, e = run_sql(host, token, wh, sql)
        print(f"  UDF {name}: {s} {e[:60] if e else ''}")

    views = {
        "v_root_cause_governed": f"""
            CREATE OR REPLACE VIEW {T}.v_root_cause_governed AS
            SELECT county_fips, county_name, state_abbr, crrall, crrint,
                pct_no_broadband, pct_undeliverable,
                {T}.mask_demographic_column(pct_spanish_limited_english) AS pct_spanish_limited_english,
                {T}.mask_demographic_column(pct_renter) AS pct_renter,
                root_cause_rank
            FROM {T}.root_cause_join
            WHERE {T}.census_region_filter(state_abbr)""",
        "v_tract_history_governed": f"""
            CREATE OR REPLACE VIEW {T}.v_tract_history_governed AS
            SELECT {T}.mask_tract_fips(tract_fips) AS tract_fips,
                tract_name, county_fips, county_name, state_abbr,
                crrall_2010, crrall_2020, delta
            FROM {T}.tract_response_history""",
    }

    for name, sql in views.items():
        s, e = run_sql(host, token, wh, sql)
        print(f"  View {name}: {s} {e[:60] if e else ''}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Create metric views
# ═══════════════════════════════════════════════════════════════════════════════

def step6_create_metric_views(host, token):
    print("\n══ Step 6: Create 4 UC Metric Views ══")

    defs = {
        "census_response_metrics": {
            "yaml": "version: 1.1\ncomment: \"Governed self-response rate KPIs for Census 2030 operations\"\nsource: census_operations_demo.operations.root_cause_join\ndimensions:\n  - name: State\n    expr: state_abbr\n  - name: County Name\n    expr: county_name\n  - name: County FIPS\n    expr: county_fips\nmeasures:\n  - name: Avg Self-Response Rate\n    expr: AVG(crrall)\n  - name: Min Self-Response Rate\n    expr: MIN(crrall)\n  - name: Avg Internet Response\n    expr: AVG(crrint)\n  - name: County Count\n    expr: COUNT(1)\n  - name: Below Benchmark\n    expr: COUNT(CASE WHEN crrall < 67 THEN 1 END)\n",
            "comment": "Governed self-response rate KPIs for Census 2030 operations"
        },
        "census_risk_metrics": {
            "yaml": "version: 1.1\ncomment: \"ML risk prediction metrics from XGBoost anomaly detection model\"\nsource: census_operations_demo.operations.anomaly_scores\ndimensions:\n  - name: State\n    expr: state_abbr\n  - name: Risk Tier\n    expr: \"CASE WHEN risk_score > 0.8 THEN 'Critical' WHEN risk_score > 0.6 THEN 'High' WHEN risk_score > 0.4 THEN 'Moderate' ELSE 'Low' END\"\n  - name: Top Factor\n    expr: top_factor_1\nmeasures:\n  - name: Avg Risk Score\n    expr: AVG(risk_score)\n  - name: High Risk Counties\n    expr: COUNT(CASE WHEN risk_score > 0.75 THEN 1 END)\n  - name: County Count\n    expr: COUNT(1)\n",
            "comment": "ML risk prediction metrics from XGBoost anomaly detection model"
        },
        "census_infrastructure_metrics": {
            "yaml": "version: 1.1\ncomment: \"Census infrastructure and accessibility metrics\"\nsource: census_operations_demo.operations.root_cause_join\ndimensions:\n  - name: State\n    expr: state_abbr\n  - name: County Name\n    expr: county_name\nmeasures:\n  - name: Avg No Broadband\n    expr: AVG(pct_no_broadband)\n  - name: Avg Undeliverable\n    expr: AVG(pct_undeliverable)\n  - name: Broadband Gap Counties\n    expr: COUNT(CASE WHEN pct_no_broadband > 30 THEN 1 END)\n  - name: County Count\n    expr: COUNT(1)\n",
            "comment": "Census infrastructure and accessibility metrics"
        },
        "census_composite_metrics": {
            "yaml": "version: 1.1\ncomment: \"Composite census quality metrics\"\nsource: census_operations_demo.operations.root_cause_join\ndimensions:\n  - name: State\n    expr: state_abbr\n  - name: County Name\n    expr: county_name\n  - name: County FIPS\n    expr: county_fips\nmeasures:\n  - name: Hard-to-Count Index\n    expr: \"AVG(0.30 * (100 - crrall) + 0.25 * pct_no_broadband + 0.25 * pct_spanish_limited_english + 0.20 * pct_renter)\"\n  - name: Digital Self-Response Gap\n    expr: \"AVG(crrall - crrint)\"\n  - name: County Count\n    expr: \"COUNT(1)\"\n",
            "comment": "Composite census quality metrics"
        },
    }

    for name, d in defs.items():
        payload = {
            "name": name, "catalog_name": CATALOG, "schema_name": SCHEMA,
            "table_type": "METRIC_VIEW", "data_source_format": "METRIC_VIEW",
            "comment": d["comment"], "view_definition": d["yaml"], "columns": [],
        }
        try:
            r = api_request(host, token, "POST", "/api/2.1/unity-catalog/tables", payload)
            print(f"  {name}: CREATED")
        except RuntimeError as e:
            if "ALREADY_EXISTS" in str(e):
                print(f"  {name}: already exists")
            else:
                print(f"  {name}: FAILED — {str(e)[:80]}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Apply tags and comments
# ═══════════════════════════════════════════════════════════════════════════════

def step7_apply_tags(host, token, wh):
    print("\n══ Step 7: Apply tags and comments ══")

    table_tags = [
        (f"{T}.root_cause_join", {"census_classification": "TITLE_13", "title_13": "protected",
         "data_classification": "confidential", "sensitivity": "pii",
         "data_source": "CENSUS_2020,ACS,FCC,USPS", "refresh_cadence": "STATIC",
         "report_period": "2020_DECENNIAL"}),
        (f"{T}.county_combined", {"census_classification": "TITLE_13", "title_13": "protected",
         "data_classification": "confidential", "sensitivity": "pii",
         "data_source": "CENSUS_2020,ACS"}),
        (f"{T}.anomaly_scores", {"census_classification": "TITLE_13", "sensitivity": "pii",
         "data_source": "ML_MODEL", "refresh_cadence": "DAILY"}),
        (f"{T}.tract_response_history", {"census_classification": "TITLE_13",
         "data_classification": "confidential", "sensitivity": "pii",
         "data_source": "CENSUS_2020", "refresh_cadence": "STATIC"}),
        (f"{T}.broadband_coverage", {"census_classification": "PUBLIC",
         "data_source": "FCC", "refresh_cadence": "STATIC"}),
        (f"{T}.usps_undeliverable", {"census_classification": "PUBLIC",
         "data_source": "USPS", "refresh_cadence": "WEEKLY"}),
        (f"{T}.county_demographics", {"census_classification": "TITLE_13", "title_13": "protected"}),
        (f"{T}.county_language", {"census_classification": "TITLE_13", "title_13": "protected"}),
        (f"{T}.county_risk_analysis", {"census_classification": "TITLE_13"}),
    ]

    for table, tags in table_tags:
        tags_str = ", ".join(f"'{k}' = '{v}'" for k, v in tags.items())
        s, e = run_sql(host, token, wh, f"ALTER TABLE {table} SET TAGS ({tags_str})")
        name = table.split(".")[-1]
        print(f"  Table {name}: {s} {e[:60] if e else ''}")

    column_tags = [
        (f"{T}.root_cause_join", "pct_spanish_limited_english",
         {"census_classification": "TITLE_13", "title_13": "protected", "column_type": "DEMOGRAPHIC"}),
        (f"{T}.root_cause_join", "pct_renter",
         {"census_classification": "TITLE_13", "column_type": "DEMOGRAPHIC"}),
        (f"{T}.root_cause_join", "county_fips",
         {"census_classification": "TITLE_13", "column_type": "GEOGRAPHIC"}),
        (f"{T}.anomaly_scores", "risk_score", {"census_classification": "TITLE_13"}),
        (f"{T}.anomaly_scores", "score_delta", {"census_classification": "TITLE_13"}),
        (f"{T}.tract_response_history", "tract_fips",
         {"census_classification": "TITLE_13", "column_type": "GEOGRAPHIC_TRACT"}),
        (f"{T}.county_combined", "pct_renter", {"title_13": "protected"}),
        (f"{T}.county_demographics", "pct_hispanic", {"title_13": "protected"}),
        (f"{T}.county_demographics", "pct_renter_occupied", {"title_13": "protected"}),
        (f"{T}.county_language", "pct_limited_english", {"title_13": "protected"}),
    ]

    for table, col, tags in column_tags:
        tags_str = ", ".join(f"'{k}' = '{v}'" for k, v in tags.items())
        s, e = run_sql(host, token, wh,
                       f"ALTER TABLE {table} ALTER COLUMN {col} SET TAGS ({tags_str})")
        name = table.split(".")[-1]
        print(f"  Column {name}.{col}: {s} {e[:60] if e else ''}")

    comments = [
        (f"{T}.root_cause_join", "Root cause analysis joining response rates with demographic and infrastructure factors"),
        (f"{T}.anomaly_scores", "ML model risk predictions using XGBoost for census response anomaly detection"),
        (f"{T}.county_combined", "Combined county-level census data with response rates and demographic indicators"),
        (f"{T}.state_combined", "State-level aggregated census response and demographic data"),
        (f"{T}.tract_response_history", "Census tract response rate history comparing 2010 and 2020 decennial censuses"),
        (f"{T}.document_chunks", "RAG document chunks from Census Bureau methodology publications"),
        (f"{T}.county_demographics", "County-level demographic indicators including race, ethnicity and housing"),
        (f"{T}.county_language", "County-level language and limited English proficiency data"),
        (f"{T}.county_risk_analysis", "County risk analysis combining ML predictions with demographic factors"),
    ]

    for table, comment in comments:
        safe = comment.replace("'", "\\'")
        s, e = run_sql(host, token, wh, f"COMMENT ON TABLE {table} IS '{safe}'")
        name = table.split(".")[-1]
        print(f"  Comment {name}: {s}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: Create groups and memberships
# ═══════════════════════════════════════════════════════════════════════════════

def step8_create_groups(host, token):
    print("\n══ Step 8: Create groups and add current user ══")
    group_names = [
        "census_title13_authorized", "census_regional_analysts",
        "census_leadership", "title13_authorized", "title26_authorized",
    ]

    me = api_request(host, token, "GET", "/api/2.0/preview/scim/v2/Me")
    user_id = me.get("id", "")
    user_email = me.get("userName", "")
    print(f"  Current user: {user_email} (id={user_id})")

    for gname in group_names:
        try:
            result = api_request(host, token, "POST", "/api/2.0/preview/scim/v2/Groups", {
                "displayName": gname,
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            })
            gid = result.get("id", "")
            print(f"  Created group: {gname} (id={gid})")
        except RuntimeError as e:
            if "already exists" in str(e).lower() or "409" in str(e):
                print(f"  Group exists: {gname}")
            else:
                print(f"  Failed to create {gname}: {str(e)[:80]}")

    filter_str = urllib.parse.quote(f'displayName eq "census_title13_authorized"')
    try:
        result = api_request(host, token, "GET",
                             f"/api/2.0/preview/scim/v2/Groups?filter={filter_str}")
        groups = result.get("Resources", [])
        if groups:
            gid = groups[0]["id"]
            try:
                api_request(host, token, "PATCH", f"/api/2.0/preview/scim/v2/Groups/{gid}", {
                    "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                    "Operations": [{"op": "add", "path": "members", "value": [{"value": user_id}]}],
                })
                print(f"  Added {user_email} to census_title13_authorized")
            except RuntimeError:
                print(f"  {user_email} already in census_title13_authorized")
    except Exception as ex:
        print(f"  Could not add to group: {ex}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: Deploy the Databricks App
# ═══════════════════════════════════════════════════════════════════════════════

def step9_deploy_app(host, token, wh, app_name, user_email):
    print(f"\n══ Step 9: Deploy Databricks App '{app_name}' ══")

    try:
        app_info = api_request(host, token, "POST", "/api/2.0/apps", {
            "name": app_name, "description": "Census Bureau Quality Monitoring Demo",
        })
        print(f"  App created: {app_info.get('name')}")
    except RuntimeError as e:
        if "already exists" in str(e):
            app_info = api_request(host, token, "GET", f"/api/2.0/apps/{app_name}")
            print(f"  App already exists: {app_info.get('name')}")
        else:
            raise

    ws_root = f"/Users/{user_email}/{app_name}"
    print(f"  Uploading source code to {ws_root}...")

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
        if upload_workspace_file(host, token, f"{ws_root}/{rel_path}", local_path):
            success += 1
    print(f"  Uploaded {success}/{len(files)} files")

    app_yaml = f"""command:
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
    value: "{wh}"
"""
    b64 = base64.b64encode(app_yaml.encode()).decode()
    api_request(host, token, "POST", "/api/2.0/workspace/import", {
        "path": f"{ws_root}/app.yaml", "format": "AUTO",
        "content": b64, "overwrite": True, "language": "",
    })
    print(f"  app.yaml configured with warehouse_id={wh}")

    print("  Waiting for compute...", flush=True)
    for i in range(20):
        info = api_request(host, token, "GET", f"/api/2.0/apps/{app_name}")
        cs = info.get("compute_status", {}).get("state", "")
        if cs == "ACTIVE":
            break
        time.sleep(15)

    result = api_request(host, token, "POST", f"/api/2.0/apps/{app_name}/deployments", {
        "source_code_path": f"/Workspace{ws_root}", "mode": "SNAPSHOT",
    })
    dep_id = result.get("deployment_id", "")
    print(f"  Deployment started: {dep_id}")

    for i in range(30):
        dep = api_request(host, token, "GET",
                          f"/api/2.0/apps/{app_name}/deployments/{dep_id}")
        ds = dep.get("status", {}).get("state", "")
        if ds == "SUCCEEDED":
            print(f"  Deployment SUCCEEDED")
            break
        if ds == "FAILED":
            print(f"  Deployment FAILED: {dep.get('status',{}).get('message','')}")
            break
        time.sleep(10)

    sp_id = app_info.get("service_principal_client_id", "")
    if sp_id:
        print(f"  Granting UC permissions to SP {sp_id}...")
        for sql in [
            f"GRANT USE CATALOG ON CATALOG {CATALOG} TO `{sp_id}`",
            f"GRANT USE SCHEMA ON SCHEMA {T} TO `{sp_id}`",
            f"GRANT SELECT ON SCHEMA {T} TO `{sp_id}`",
            f"GRANT READ VOLUME ON VOLUME {T}.census_documents TO `{sp_id}`",
        ]:
            run_sql(host, token, wh, sql)
        print(f"  Permissions granted")

    app_url = app_info.get("url", "")
    return app_url


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Deploy Census Quality Monitoring Demo (end-to-end)"
    )
    parser.add_argument("--host", required=True,
                        help="Target workspace URL")
    parser.add_argument("--warehouse-id", required=True,
                        help="SQL warehouse ID")
    parser.add_argument("--profile", default=None,
                        help="Databricks CLI profile")
    parser.add_argument("--app-name", default="census-quality-demo",
                        help="App name (default: census-quality-demo)")
    parser.add_argument("--skip-app", action="store_true",
                        help="Skip app deployment (UC objects only)")
    args = parser.parse_args()

    host = args.host.rstrip("/")
    if not host.startswith("https://"):
        host = f"https://{host}"

    print("=" * 60)
    print("Census Quality Monitoring Demo — Full Deployment")
    print("=" * 60)
    print(f"  Host:      {host}")
    print(f"  Warehouse: {args.warehouse_id}")
    print(f"  App:       {args.app_name}")
    print()

    token = get_token(host, args.profile)
    me = api_request(host, token, "GET", "/api/2.0/preview/scim/v2/Me")
    user_email = me.get("userName", "")
    print(f"  Authenticated as: {user_email}")

    step1_create_catalog(host, token, args.warehouse_id)
    step2_upload_data(host, token)
    step3_load_base_tables(host, token, args.warehouse_id)
    step4_create_derived_tables(host, token, args.warehouse_id)
    step5_create_udfs_and_views(host, token, args.warehouse_id)
    step6_create_metric_views(host, token)
    step7_apply_tags(host, token, args.warehouse_id)
    step8_create_groups(host, token)

    if not args.skip_app:
        app_url = step9_deploy_app(host, token, args.warehouse_id,
                                   args.app_name, user_email)
    else:
        app_url = "(skipped)"

    print()
    print("=" * 60)
    print("DEPLOYMENT COMPLETE")
    print("=" * 60)
    print(f"  Catalog:      {CATALOG}")
    print(f"  Schema:       {T}")
    print(f"  Tables:       27 managed + 2 views + 4 metric views = 33 objects")
    print(f"  UDFs:         5 (masking + filtering + suppression)")
    print(f"  Tags:         census_classification, title_13, sensitivity, etc.")
    print(f"  Groups:       census_title13_authorized + 4 others")
    print(f"  App URL:      {app_url}")
    print("=" * 60)


if __name__ == "__main__":
    main()
