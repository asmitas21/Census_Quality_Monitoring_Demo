"""
Export all Census Demo UC tables from the source workspace as CSV files.

Usage:
    python scripts/export_source_data.py [--host HOST] [--warehouse-id WH_ID]

Requires --host and --warehouse-id arguments.
Exports to scripts/data/*.csv
"""
import argparse
import csv
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
CATALOG = "census_operations_demo"
SCHEMA = "operations"

TABLES_TO_EXPORT = [
    "root_cause_join",
    "anomaly_scores",
    "broadband_coverage",
    "usps_undeliverable",
    "tract_response_history",
    "rag_chunks",
    "rag_mappings",
    "genie_examples",
    "document_chunks",
    "county_combined",
    "state_combined",
]

MAX_ROWS = 50000


def get_token(host: str) -> str:
    result = subprocess.check_output(
        ["databricks", "auth", "token", "--host", host], text=True
    )
    return json.loads(result)["access_token"]


def execute_sql(host: str, token: str, warehouse_id: str, query: str) -> tuple[list[str], list[list]]:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = json.dumps({
        "warehouse_id": warehouse_id,
        "statement": query,
        "wait_timeout": "50s",
        "row_limit": MAX_ROWS,
    }).encode()
    req = urllib.request.Request(f"{host}/api/2.0/sql/statements", data=data, headers=headers, method="POST")
    resp = json.loads(urllib.request.urlopen(req).read().decode())

    state = resp.get("status", {}).get("state")
    if state != "SUCCEEDED":
        error = resp.get("status", {}).get("error", {}).get("message", "unknown")
        raise RuntimeError(f"SQL failed ({state}): {error}")

    columns = [c["name"] for c in resp["manifest"]["schema"]["columns"]]
    rows = resp.get("result", {}).get("data_array", [])
    return columns, rows


def export_table(host: str, token: str, warehouse_id: str, table_name: str):
    full_name = f"{CATALOG}.{SCHEMA}.{table_name}"
    print(f"  Exporting {full_name}...", end=" ", flush=True)

    columns, rows = execute_sql(host, token, warehouse_id, f"SELECT * FROM {full_name}")

    out_path = DATA_DIR / f"{table_name}.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows)

    print(f"{len(rows)} rows → {out_path.name}")
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="Export Census Demo UC tables")
    parser.add_argument("--host", required=True, help="Databricks workspace URL (e.g. https://my-workspace.cloud.databricks.com)")
    parser.add_argument("--warehouse-id", required=True, help="SQL warehouse ID")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Source: {args.host}")
    print(f"Warehouse: {args.warehouse_id}")
    print(f"Output: {DATA_DIR}\n")

    token = get_token(args.host)
    total = 0

    for table in TABLES_TO_EXPORT:
        try:
            total += export_table(args.host, token, args.warehouse_id, table)
        except Exception as e:
            print(f"FAILED: {e}")

    print(f"\nDone. Exported {total:,} total rows across {len(TABLES_TO_EXPORT)} tables.")
    print(f"CSV files saved to: {DATA_DIR.resolve()}")


if __name__ == "__main__":
    main()
