# Census Quality Monitoring Demo — Deployment Scripts

Deploy the Census Quality Monitoring Demo to any Databricks workspace.

## One-Command Deployment

```bash
python scripts/deploy_full_demo.py \
    --host https://YOUR-WORKSPACE.cloud.databricks.com \
    --warehouse-id YOUR_WAREHOUSE_ID \
    --profile YOUR_PROFILE
```

This single script performs all 9 steps:

| Step | What It Creates |
|------|----------------|
| 1 | Catalog `census_operations_demo`, schema `operations`, volumes |
| 2 | Uploads 11 CSV files + 3 PDF methodology documents |
| 3 | Loads 11 base Delta tables from CSV |
| 4 | Creates 16 derived tables via SQL transformations |
| 5 | Creates 5 UDFs (masking, filtering, suppression) + 2 governed views |
| 6 | Creates 4 UC Metric Views with YAML definitions |
| 7 | Applies all tags (census_classification, title_13, sensitivity, etc.) + table comments |
| 8 | Creates 5 groups and adds current user to census_title13_authorized |
| 9 | Deploys the Databricks App with service principal grants |

### Options

```
--host          Target workspace URL (required)
--warehouse-id  SQL warehouse ID (required)
--profile       Databricks CLI profile (optional)
--app-name      App name, default: census-quality-demo (optional)
--skip-app      Only create UC objects, skip app deployment (optional)
```

## UC-Only Setup (No App)

To set up just the Unity Catalog objects without deploying the app:

```bash
python scripts/deploy_full_demo.py \
    --host https://YOUR-WORKSPACE.cloud.databricks.com \
    --warehouse-id YOUR_WAREHOUSE_ID \
    --skip-app
```

## Individual Scripts

| Script | Purpose |
|--------|---------|
| `deploy_full_demo.py` | **Recommended** — end-to-end deployment (all 33 objects + app) |
| `deploy_census_app.py` | App-only deployment (assumes UC objects exist) |
| `setup_census_demo.py` | Databricks notebook — creates 11 base tables + groups |
| `export_source_data.py` | Export UC tables from source workspace as CSV |

## Requirements

- Databricks CLI authenticated to the target workspace
- Python 3.10+
- CREATE CATALOG privilege on target workspace
- A SQL warehouse
