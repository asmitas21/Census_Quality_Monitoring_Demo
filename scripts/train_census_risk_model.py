# Databricks notebook source
# MAGIC %md
# MAGIC # Census Risk Model Training
# MAGIC 
# MAGIC Trains an XGBoost regression model to predict county-level Census self-response rates
# MAGIC based on operational barrier features. Logs all artifacts to MLflow for full traceability.
# MAGIC
# MAGIC **Features:** broadband coverage, USPS deliverability, language barriers, renter rates
# MAGIC **Target:** `crrall` (all-mode self-response rate %)
# MAGIC **Output:** Registered model in Unity Catalog with SHAP explanations

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Setup & Load Data

# COMMAND ----------

import mlflow
import mlflow.xgboost
from mlflow.models.signature import infer_signature

mlflow.set_registry_uri("databricks-uc")

CATALOG = "census_operations_demo"
SCHEMA = "operations"
MODEL_NAME = f"{CATALOG}.{SCHEMA}.census_risk_model"
import getpass
_user = dbutils.notebook.entry_point.getDbutils().notebook().getContext().userName().get()
EXPERIMENT_NAME = f"/Users/{_user}/census_risk_model_experiment"

mlflow.set_experiment(EXPERIMENT_NAME)

df = spark.table(f"{CATALOG}.{SCHEMA}.root_cause_join").toPandas()
print(f"Loaded {len(df)} counties from {CATALOG}.{SCHEMA}.root_cause_join")
df.head()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Prepare Features & Split Data

# COMMAND ----------

import pandas as pd
from sklearn.model_selection import train_test_split

FEATURE_COLS = ["pct_no_broadband", "pct_undeliverable", "pct_spanish_limited_english", "pct_renter"]
TARGET = "crrall"

df_clean = df.dropna(subset=FEATURE_COLS + [TARGET])
X = df_clean[FEATURE_COLS]
y = df_clean[TARGET]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"Training: {len(X_train)} counties | Test: {len(X_test)} counties")
print(f"\nFeature summary:")
print(X_train.describe().round(2))

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Train XGBoost & Log to MLflow

# COMMAND ----------

import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np
import matplotlib.pyplot as plt

params = {
    "n_estimators": 200,
    "max_depth": 5,
    "learning_rate": 0.1,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "random_state": 42,
    "objective": "reg:squarederror",
}

with mlflow.start_run(run_name="census_risk_xgboost") as run:
    mlflow.log_params(params)
    mlflow.log_param("features", FEATURE_COLS)
    mlflow.log_param("target", TARGET)
    mlflow.log_param("training_table", f"{CATALOG}.{SCHEMA}.root_cause_join")
    mlflow.log_param("n_train", len(X_train))
    mlflow.log_param("n_test", len(X_test))

    model = xgb.XGBRegressor(**params)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    mlflow.log_metric("mae", mae)
    mlflow.log_metric("rmse", rmse)
    mlflow.log_metric("r2", r2)
    print(f"MAE: {mae:.2f}% | RMSE: {rmse:.2f}% | R²: {r2:.3f}")

    # Feature importance plot
    importance = dict(zip(FEATURE_COLS, model.feature_importances_))
    for feat, imp in importance.items():
        mlflow.log_metric(f"importance_{feat}", float(imp))

    fig, ax = plt.subplots(figsize=(8, 4))
    sorted_imp = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
    labels = {
        "pct_no_broadband": "Broadband Gap",
        "pct_undeliverable": "USPS Undeliverable",
        "pct_spanish_limited_english": "Language Barrier",
        "pct_renter": "Renter Rate",
    }
    ax.barh(
        [labels.get(k, k) for k in sorted_imp.keys()],
        list(sorted_imp.values()),
        color=["#FF3621", "#FF6B4A", "#FF9E73", "#FFC89C"],
    )
    ax.set_xlabel("Feature Importance")
    ax.set_title("Census Risk Model — Feature Importance")
    plt.tight_layout()
    fig.savefig("/tmp/feature_importance.png", dpi=150)
    mlflow.log_artifact("/tmp/feature_importance.png")
    plt.close()

    # Actual vs predicted plot
    fig2, ax2 = plt.subplots(figsize=(6, 6))
    ax2.scatter(y_test, y_pred, alpha=0.4, s=10, color="#FF3621")
    ax2.plot([20, 90], [20, 90], "k--", alpha=0.5)
    ax2.set_xlabel("Actual Response Rate (%)")
    ax2.set_ylabel("Predicted Response Rate (%)")
    ax2.set_title(f"Actual vs Predicted (R² = {r2:.3f})")
    plt.tight_layout()
    fig2.savefig("/tmp/actual_vs_predicted.png", dpi=150)
    mlflow.log_artifact("/tmp/actual_vs_predicted.png")
    plt.close()

    # SHAP explanations
    try:
        import shap
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_test)

        fig3, ax3 = plt.subplots(figsize=(8, 5))
        shap.summary_plot(shap_values, X_test, feature_names=[labels.get(c, c) for c in FEATURE_COLS], show=False)
        plt.tight_layout()
        plt.savefig("/tmp/shap_summary.png", dpi=150, bbox_inches="tight")
        mlflow.log_artifact("/tmp/shap_summary.png")
        plt.close()
        print("SHAP summary plot logged")
    except Exception as e:
        print(f"SHAP plot skipped: {e}")

    # Log and register model
    signature = infer_signature(X_train, model.predict(X_train))
    mlflow.xgboost.log_model(
        model,
        artifact_path="model",
        signature=signature,
        input_example=X_train.head(3),
        registered_model_name=MODEL_NAME,
    )

    run_id = run.info.run_id
    print(f"\nRun ID: {run_id}")
    print(f"Model registered: {MODEL_NAME}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Generate Predictions for All Counties (anomaly_scores_v2)

# COMMAND ----------

X_all = df_clean[FEATURE_COLS]
predicted_crrall = model.predict(X_all)

risk_scores = 1.0 - (predicted_crrall / 100.0)
risk_scores = np.clip(risk_scores, 0.0, 1.0)

importances = model.feature_importances_
factor_labels = ["BROADBAND", "USPS", "LANGUAGE", "RENTER"]

results = df_clean[["county_fips", "county_name", "state_abbr"]].copy()
results["risk_score"] = np.round(risk_scores, 2)
results["predicted_crrall"] = np.round(predicted_crrall, 1)
results["actual_crrall"] = df_clean[TARGET].values
results["residual"] = np.round(results["actual_crrall"] - results["predicted_crrall"], 1)

for i, row in enumerate(X_all.values):
    weighted = row * importances
    ranked = np.argsort(-weighted)
    total = weighted.sum() if weighted.sum() > 0 else 1.0
    results.loc[results.index[i], "top_factor_1"] = factor_labels[ranked[0]]
    results.loc[results.index[i], "top_factor_1_weight"] = round(float(weighted[ranked[0]] / total), 2)
    results.loc[results.index[i], "top_factor_2"] = factor_labels[ranked[1]]
    results.loc[results.index[i], "top_factor_2_weight"] = round(float(weighted[ranked[1]] / total), 2)

results_spark = spark.createDataFrame(results)
results_spark.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.anomaly_scores_v2")
print(f"Wrote {len(results)} rows to {CATALOG}.{SCHEMA}.anomaly_scores_v2")
results.sort_values("risk_score", ascending=False).head(10)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Summary
# MAGIC
# MAGIC **What was created:**
# MAGIC - MLflow Experiment: `census_risk_model_experiment`
# MAGIC - Registered Model: `census_operations_demo.operations.census_risk_model`
# MAGIC - Predictions Table: `census_operations_demo.operations.anomaly_scores_v2`
# MAGIC
# MAGIC **Traceability chain:**
# MAGIC - Source data → `root_cause_join` (tagged, governed in UC)
# MAGIC - Training run → MLflow experiment (params, metrics, artifacts)
# MAGIC - Model → UC Model Registry (versioned, lineage tracked)
# MAGIC - Predictions → `anomaly_scores_v2` (every score traceable to model + input features)
