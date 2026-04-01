# Census Quality Monitoring Demo

A full-stack Databricks App demonstrating enterprise data governance, ML-driven anomaly detection, and operational intelligence for Census Bureau–style data. Built with **React + FastAPI**, deployed as a **Databricks App**.

## What This Demo Shows

| Capability | How It's Demonstrated |
|---|---|
| **Unity Catalog Governance** | 33 tables/views with tags, comments, column-level classification |
| **ABAC (Attribute-Based Access Control)** | UDFs that mask Title 13 protected columns based on group membership |
| **Metric Views** | 4 UC Metric Views with YAML definitions for governed KPIs |
| **ML Traceability** | XGBoost risk model tracked in MLflow with full experiment lineage |
| **Genie Spaces** | Natural language SQL — tuned vs. untuned comparison |
| **Row & Column Filtering** | Governed views with dynamic masking and region-based row filters |
| **Data Lineage** | End-to-end traceability via `system.access.table_lineage` |
| **Query Auditing** | `system.query.history` for compliance and access tracking |

## App Screens

| Screen | Description |
|---|---|
| **Command Center** | KPI badges (51 states, 3,208 counties, 202 tracts), Factor Explorer scatter plot |
| **Investigate** | County drilldown with Response Trend, Root Cause, and Methodology tabs |
| **Geography** | State-level choropleth heatmap |
| **Genie** | Side-by-side tuned vs. untuned Genie Space comparison |
| **Metric Views** | UC Metric View browser with live composite metrics |
| **Governed Access** | Grant/revoke UC permissions, entitlement management |
| **Audit Log** | Query history and data access audit trail |

---

## Prerequisites

- **Python 3.10+** and **Node 18+**
- **Databricks CLI 0.229+** authenticated to your target workspace
- **CREATE CATALOG** privilege on the workspace
- A **SQL warehouse** (serverless recommended)
- A **Foundation Model API endpoint** (e.g. `databricks-claude-sonnet-4-5` or any chat model)
- *(Optional)* A **Lakebase database** for the audit log persistence layer

## Quick Start — Deploy to Your Workspace

### 1. Clone the repo

```bash
git clone https://github.com/asmita-shah_data/Census_Demo_Shared.git
cd Census_Demo_Shared
```

### 2. Run the full setup

This single command creates all Unity Catalog objects and deploys the app:

```bash
python scripts/deploy_full_demo.py \
    --host https://YOUR-WORKSPACE.cloud.databricks.com \
    --warehouse-id YOUR_WAREHOUSE_ID \
    --profile YOUR_DATABRICKS_CLI_PROFILE
```

Replace the placeholders:

| Placeholder | Where to find it |
|---|---|
| `YOUR-WORKSPACE` | Your Databricks workspace URL (e.g. `mycompany.cloud.databricks.com`) |
| `YOUR_WAREHOUSE_ID` | SQL Warehouses page → click your warehouse → copy the ID from the URL |
| `YOUR_DATABRICKS_CLI_PROFILE` | The profile name from `~/.databrickscfg` (use `DEFAULT` if only one) |

### 3. Configure `app.yaml`

Before deploying the app, update `app.yaml` with your workspace-specific values:

```yaml
env:
  - name: PGHOST
    value: YOUR_LAKEBASE_ENDPOINT       # Lakebase database hostname
  - name: PGUSER
    value: "YOUR_SERVICE_PRINCIPAL_UUID" # Service principal application ID
  - name: DATABRICKS_WAREHOUSE_ID
    value: "YOUR_WAREHOUSE_ID"           # Same warehouse ID as above
  - name: SERVING_ENDPOINT
    value: databricks-claude-sonnet-4-5  # Or any Foundation Model API endpoint
```

> **Note:** If you don't have a Lakebase database, the app will still work — the audit log will use an in-memory fallback.

### What the Setup Creates

1. **Catalog & Schema**: `census_operations_demo.operations`
2. **Volumes**: `staging` (CSV data), `census_documents` (methodology PDFs)
3. **11 base tables** loaded from `scripts/data/*.csv`
4. **16 derived tables** created via SQL transformations
5. **5 UDFs** for column masking and row filtering
6. **2 governed views** with dynamic ABAC enforcement
7. **4 metric views** with YAML definitions
8. **Tags** on all tables and sensitive columns
9. **Groups** with current user membership
10. **Databricks App** deployed with service principal grants

---

## Unity Catalog Objects

### Tables (27 managed Delta tables)

Core tables loaded from CSV:
`root_cause_join`, `anomaly_scores`, `county_combined`, `state_combined`, `broadband_coverage`, `usps_undeliverable`, `tract_response_history`, `document_chunks`, `rag_chunks`, `rag_mappings`, `genie_examples`

Derived tables (created from core data):
`anomaly_scores_v2`, `county_census_2010`, `county_demographics`, `county_household_relationships`, `county_language`, `county_response_rates`, `county_risk_analysis`, `census_docs`, `pdf_chunks`, `pdf_chunks_embedded`, `census-final-endpoint_payload`, `state_response_rates`, `state_demographics`, `tract_demographics`, `tract_detailed_demographics`, `tract_response_rates`

### Views (2 governed views)

- `v_root_cause_governed` — applies `mask_demographic_column()` on Title 13 columns + `census_region_filter()` for row-level access
- `v_tract_history_governed` — applies `mask_tract_fips()` to protect geographic quasi-identifiers

### Metric Views (4)

- `census_response_metrics` — self-response rate KPIs by state/county
- `census_risk_metrics` — ML risk prediction metrics by state and risk tier
- `census_infrastructure_metrics` — broadband and mail deliverability metrics
- `census_composite_metrics` — Hard-to-Count Index and Digital Self-Response Gap

### UDFs (5)

- `mask_demographic_column(value)` — returns NULL if caller is not in `census_title13_authorized`
- `mask_tract_fips(tract_fips)` — masks tract FIPS codes for unauthorized users
- `census_region_filter(state_abbr)` — row filter restricting regional analysts to their states
- `suppress_small_pct(value)` — suppresses small percentages for disclosure avoidance
- `suppress_small_counts(value)` — suppresses small counts for disclosure avoidance

### Tags

| Tag | Values | Applied To |
|---|---|---|
| `census_classification` | `TITLE_13`, `PUBLIC` | Tables + 6 sensitive columns |
| `title_13` | `protected` | Tables with protected demographic data |
| `sensitivity` | `pii` | Tables with personally identifiable patterns |
| `data_source` | `CENSUS_2020`, `ACS`, `FCC`, `USPS`, `ML_MODEL` | All tables |
| `data_classification` | `confidential`, `internal` | Sensitive tables |
| `refresh_cadence` | `DAILY`, `WEEKLY`, `STATIC` | All tables |
| `column_type` | `DEMOGRAPHIC`, `GEOGRAPHIC`, `GEOGRAPHIC_TRACT` | Sensitive columns |

### Groups

- `census_title13_authorized` — users authorized to see Title 13 protected data
- `census_regional_analysts` — users limited to specific state regions
- `census_leadership` — leadership-level access
- `title13_authorized`, `title26_authorized` — additional authorization groups

---

## Live ABAC Demo

Show column masking in real-time by toggling group membership:

```sql
-- 1. Verify membership
SELECT IS_MEMBER('census_title13_authorized') AS authorized;

-- 2. Query governed view (shows real values when authorized)
SELECT county_name, state_abbr, pct_spanish_limited_english, pct_renter
FROM census_operations_demo.operations.v_root_cause_governed
WHERE state_abbr = 'SD' LIMIT 5;

-- 3. Remove yourself from group (run in a Python cell):
--    See the SCIM API example in scripts/deploy_full_demo.py → step8_create_groups
-- 4. Re-run query — protected columns now show NULL
-- 5. Add yourself back
```

---

## Training the ML Risk Model (Optional)

The XGBoost risk model is pre-trained, but you can retrain it:

1. Import `scripts/train_census_risk_model.py` as a Databricks notebook
2. Attach it to a cluster with `mlflow`, `xgboost`, `shap` installed
3. Run all cells — the experiment path is auto-set to your user folder

The model is registered as `census_operations_demo.operations.census_risk_model` in Unity Catalog.

---

## Creating Genie Spaces (Optional)

To demo the tuned vs. untuned Genie comparison:

1. Create two Genie Spaces in your workspace
2. **Tuned**: add tables `county_response_rates`, `county_demographics`, `state_combined`, `root_cause_join` and provide example questions from `scripts/data/genie_examples.csv`
3. **Untuned**: add the same tables but no examples
4. Update the Genie Space IDs in `server/routes/ai.py` → `GENIE_SPACE_ID`

---

## Local Development

```bash
# Backend
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
export DATABRICKS_PROFILE=DEFAULT
uv run uvicorn app:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

Frontend: http://localhost:5173 | Backend: http://localhost:8000

---

## Project Structure

```
├── app.py                    # FastAPI entry point
├── app.yaml                  # Databricks App config (update with your values)
├── frontend/
│   ├── src/screens/          # React screens (Command Center, Investigate, etc.)
│   └── dist/                 # Production build
├── server/
│   ├── routes/               # API routes (drilldown, snapshot, ai, etc.)
│   ├── uc_client.py          # Unity Catalog SQL execution
│   ├── census_data.py        # Real Census data loader (Pandas)
│   ├── config.py             # Databricks SDK configuration
│   └── auth.py               # Authentication and entitlement
├── scripts/
│   ├── data/                 # 11 CSV source files
│   ├── pdfs/                 # Methodology PDF documents
│   ├── deploy_full_demo.py   # One-command full setup (recommended)
│   ├── deploy_census_app.py  # App-only deployment
│   ├── setup_census_demo.py  # Notebook: creates UC objects
│   └── train_census_risk_model.py  # Notebook: trains XGBoost model
└── requirements.txt
```
