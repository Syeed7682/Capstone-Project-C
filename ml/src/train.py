"""
train.py
────────
End-to-end training pipeline:

  1. Load validated data
  2. Export to Parquet (Feast offline store)
  3. Apply feature engineering
  4. Train a RandomForestClassifier
  5. Evaluate (AUC-ROC, F1, Precision, Recall)
  6. Log everything to MLflow (params, metrics, artifacts)
  7. Register model in MLflow Model Registry
  8. Transition best model to Staging → Production

Usage
-----
  python src/train.py
  python src/train.py --data data/validated/transactions.csv --n-estimators 200
"""

import os
import sys
import argparse
import logging
import joblib
import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score,
    classification_report, confusion_matrix,
)

# Add src/ to path so relative imports work when invoked directly
sys.path.insert(0, os.path.dirname(__file__))
from feature_engineering import prepare_features, TARGET_COLUMN

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

ROOT         = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH    = os.path.join(ROOT, "data", "validated", "transactions.csv")
PARQUET_DIR  = os.path.join(ROOT, "data", "feast")
MODELS_DIR   = os.path.join(ROOT, "models")
MLFLOW_URI   = os.path.join(ROOT, "mlruns")
EXPERIMENT   = "fraud-detection"
MODEL_NAME   = "fraud-detection-model"


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["event_timestamp"])
    log.info(f"Loaded {len(df):,} rows from {path}")
    return df


def export_parquet(df: pd.DataFrame) -> str:
    """Write validated data to Parquet for Feast offline store."""
    os.makedirs(PARQUET_DIR, exist_ok=True)
    parquet_path = os.path.join(PARQUET_DIR, "transactions.parquet")
    df.to_parquet(parquet_path, index=False)
    log.info(f"Parquet written → {parquet_path}")
    return parquet_path


def train_model(
    df: pd.DataFrame,
    n_estimators: int = 150,
    max_depth: int = 12,
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict:
    """Train model and return a results dict."""

    # ── Feature prep ──────────────────────────────────────────────────────
    from feature_engineering import build_preprocessor, NUMERIC_FEATURES_EXT, CATEGORICAL_FEATURES
    from sklearn.pipeline import Pipeline

    X = prepare_features(df)
    y = df[TARGET_COLUMN].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    log.info(f"Train: {len(X_train):,}  |  Test: {len(X_test):,}")

    # ── Build pipeline ────────────────────────────────────────────────────
    preprocessor = build_preprocessor()
    clf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        class_weight="balanced",   # handles class imbalance
        random_state=random_state,
        n_jobs=-1,
    )
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier",   clf),
    ])

    # ── Fit ───────────────────────────────────────────────────────────────
    log.info(f"Training RandomForestClassifier (n_estimators={n_estimators}, max_depth={max_depth}) …")
    pipeline.fit(X_train, y_train)

    # ── Evaluate ──────────────────────────────────────────────────────────
    y_pred      = pipeline.predict(X_test)
    y_pred_prob = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "auc_roc":   round(roc_auc_score(y_test, y_pred_prob), 4),
        "f1_score":  round(f1_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred), 4),
        "recall":    round(recall_score(y_test, y_pred), 4),
    }

    log.info(f"  AUC-ROC  : {metrics['auc_roc']}")
    log.info(f"  F1       : {metrics['f1_score']}")
    log.info(f"  Precision: {metrics['precision']}")
    log.info(f"  Recall   : {metrics['recall']}")
    print("\n" + classification_report(y_test, y_pred, target_names=["legit", "fraud"]))

    return {
        "pipeline":  pipeline,
        "metrics":   metrics,
        "X_test":    X_test,
        "y_test":    y_test,
        "y_pred":    y_pred,
        "y_pred_prob": y_pred_prob,
        "params": {
            "n_estimators": n_estimators,
            "max_depth":    max_depth,
            "test_size":    test_size,
            "random_state": random_state,
        },
    }


def log_to_mlflow(results: dict, df: pd.DataFrame) -> str:
    """Log run to MLflow and register model. Returns run_id."""
    mlflow.set_tracking_uri(f"file:///{MLFLOW_URI}")
    mlflow.set_experiment(EXPERIMENT)

    with mlflow.start_run() as run:
        run_id = run.info.run_id
        log.info(f"MLflow run_id: {run_id}")

        # Log parameters
        mlflow.log_params(results["params"])
        mlflow.log_param("training_rows", len(df))

        # Log metrics
        mlflow.log_metrics(results["metrics"])

        # Log pipeline model
        model_info = mlflow.sklearn.log_model(
            sk_model=results["pipeline"],
            artifact_path="model",
            registered_model_name=MODEL_NAME,
        )
        log.info(f"Model logged: {model_info.model_uri}")

        # Save a local copy
        os.makedirs(MODELS_DIR, exist_ok=True)
        local_path = os.path.join(MODELS_DIR, "model.pkl")
        joblib.dump(results["pipeline"], local_path)
        mlflow.log_artifact(local_path, artifact_path="local_copy")
        log.info(f"Local model saved → {local_path}")

        # Save reference data for Evidently
        ref_path = os.path.join(ROOT, "data", "reference", "reference_data.csv")
        os.makedirs(os.path.dirname(ref_path), exist_ok=True)
        ref_df = df.sample(n=min(2000, len(df)), random_state=42)
        ref_df.to_csv(ref_path, index=False)
        mlflow.log_artifact(ref_path, artifact_path="reference_data")
        log.info(f"Reference data saved → {ref_path}")

    return run_id


def transition_model_to_production(model_name: str = MODEL_NAME) -> None:
    """Move the latest model version to Production stage."""
    client = mlflow.tracking.MlflowClient(tracking_uri=f"file:///{MLFLOW_URI}")
    versions = client.get_latest_versions(model_name)
    if not versions:
        log.warning("No model versions found — skipping stage transition.")
        return

    latest = max(versions, key=lambda v: int(v.version))
    log.info(f"Transitioning model v{latest.version} → Production")
    client.transition_model_version_stage(
        name=model_name,
        version=latest.version,
        stage="Production",
        archive_existing_versions=True,
    )
    log.info(f"✅  Model '{model_name}' v{latest.version} is now in Production")


# ── CLI entry point ───────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Train the fraud detection model")
    p.add_argument("--data",          default=DATA_PATH,   help="Path to validated CSV")
    p.add_argument("--n-estimators",  default=150,  type=int)
    p.add_argument("--max-depth",     default=12,   type=int)
    p.add_argument("--test-size",     default=0.2,  type=float)
    p.add_argument("--no-register",   action="store_true", help="Skip MLflow registration")
    return p.parse_args()


def main():
    args = parse_args()

    df = load_data(args.data)
    export_parquet(df)

    results = train_model(
        df,
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        test_size=args.test_size,
    )

    if not args.no_register:
        run_id = log_to_mlflow(results, df)
        transition_model_to_production()
        log.info(f"\n🎉  Training complete. MLflow run: {run_id}")
        log.info(f"    View results: mlflow ui --backend-store-uri {MLFLOW_URI}")
    else:
        log.info("Skipped MLflow registration (--no-register flag set)")

    return results


if __name__ == "__main__":
    main()
