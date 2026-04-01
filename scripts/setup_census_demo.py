# Databricks notebook source
# MAGIC %md
# MAGIC # Census Quality Monitoring Demo — Workspace Setup
# MAGIC
# MAGIC Run this notebook on any Databricks workspace to set up all Unity Catalog
# MAGIC resources needed for the Census Quality Monitoring Demo app.
# MAGIC
# MAGIC **Prerequisites:**
# MAGIC 1. Upload CSV data files to `/Volumes/census_operations_demo/operations/staging/` first
# MAGIC    (use the deploy script or manually upload the `scripts/data/*.csv` files)
# MAGIC 2. You must have CREATE CATALOG privilege
# MAGIC 3. A SQL warehouse must be available
# MAGIC
# MAGIC **Creates:**
# MAGIC - Catalog: `census_operations_demo`
# MAGIC - Schema: `census_operations_demo.operations`
# MAGIC - 11 Delta tables loaded from CSV
# MAGIC - Volume: `census_documents` (for PDF files)
# MAGIC - Groups: `title13_authorized`, `title26_authorized`

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configuration

# COMMAND ----------

CATALOG = "census_operations_demo"
SCHEMA = "operations"
STAGING_VOLUME = "staging"
DOCS_VOLUME = "census_documents"

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Create Catalog, Schema, and Volumes

# COMMAND ----------

spark.sql(f"CREATE CATALOG IF NOT EXISTS {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")
spark.sql(f"CREATE VOLUME IF NOT EXISTS {CATALOG}.{SCHEMA}.{STAGING_VOLUME}")
spark.sql(f"CREATE VOLUME IF NOT EXISTS {CATALOG}.{SCHEMA}.{DOCS_VOLUME}")
print(f"Created catalog={CATALOG}, schema={SCHEMA}, volumes={STAGING_VOLUME},{DOCS_VOLUME}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Load Tables from CSV
# MAGIC
# MAGIC Reads CSV files from the staging volume and creates Delta tables.
# MAGIC Upload your CSV files to `/Volumes/census_operations_demo/operations/staging/` before running.

# COMMAND ----------

import os

staging_path = f"/Volumes/{CATALOG}/{SCHEMA}/{STAGING_VOLUME}"

csv_files = [f for f in os.listdir(staging_path) if f.endswith(".csv")]
print(f"Found {len(csv_files)} CSV files in {staging_path}:")
for f in sorted(csv_files):
    print(f"  {f}")

# COMMAND ----------

TABLES_CONFIG = {
    "root_cause_join": {"infer_schema": True},
    "anomaly_scores": {"infer_schema": True},
    "broadband_coverage": {"infer_schema": True},
    "usps_undeliverable": {"infer_schema": True},
    "tract_response_history": {"infer_schema": True},
    "rag_chunks": {"infer_schema": True},
    "rag_mappings": {"infer_schema": True},
    "genie_examples": {"infer_schema": True},
    "document_chunks": {"infer_schema": True},
    "county_combined": {"infer_schema": True},
    "state_combined": {"infer_schema": True},
}

for table_name, config in TABLES_CONFIG.items():
    csv_path = f"{staging_path}/{table_name}.csv"
    full_table = f"{CATALOG}.{SCHEMA}.{table_name}"

    if not os.path.exists(csv_path):
        print(f"  SKIP {table_name} — {csv_path} not found")
        continue

    df = (
        spark.read.format("csv")
        .option("header", "true")
        .option("inferSchema", "true")
        .option("multiLine", "true")
        .option("escape", '"')
        .load(csv_path)
    )

    df.write.mode("overwrite").saveAsTable(full_table)
    count = spark.table(full_table).count()
    print(f"  {full_table}: {count} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Create UC Groups

# COMMAND ----------

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

for group_name in ["title13_authorized", "title26_authorized"]:
    try:
        from databricks.sdk.service.iam import Group
        w.groups.create(display_name=group_name)
        print(f"  Created group: {group_name}")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"  Group already exists: {group_name}")
        else:
            print(f"  Could not create group {group_name}: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Add Current User to Groups

# COMMAND ----------

current_user = spark.sql("SELECT current_user()").collect()[0][0]
print(f"Current user: {current_user}")

users = list(w.users.list(filter=f'userName eq "{current_user}"'))
if users:
    user_id = users[0].id
    for group_name in ["title13_authorized", "title26_authorized"]:
        try:
            groups = list(w.groups.list(filter=f'displayName eq "{group_name}"'))
            if groups:
                from databricks.sdk.service.iam import PatchOp, PatchSchema, GroupPatchOp
                w.groups.patch(
                    groups[0].id,
                    operations=[PatchOp(op=GroupPatchOp.ADD, value=[{"value": user_id}])],
                    schemas=[PatchSchema.URN_IETF_PARAMS_SCIM_API_MESSAGES_2_0_PATCH_OP],
                )
                print(f"  Added {current_user} to {group_name}")
        except Exception as e:
            if "already" in str(e).lower() or "conflict" in str(e).lower():
                print(f"  {current_user} already in {group_name}")
            else:
                print(f"  Could not add to {group_name}: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Verification

# COMMAND ----------

print("=" * 60)
print("VERIFICATION")
print("=" * 60)

for table_name in TABLES_CONFIG:
    full_name = f"{CATALOG}.{SCHEMA}.{table_name}"
    try:
        count = spark.table(full_name).count()
        print(f"  {full_name}: {count} rows ✓")
    except Exception as e:
        print(f"  {full_name}: ERROR - {e}")

print()
print(f"  Volume: /Volumes/{CATALOG}/{SCHEMA}/{DOCS_VOLUME}")
print(f"  Groups: title13_authorized, title26_authorized")
print("=" * 60)
print("Setup complete! Now run deploy_census_app.py to deploy the app.")
print("=" * 60)
