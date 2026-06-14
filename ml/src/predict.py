"""
predict.py
──────────
Inference helper — loads the Production model from MLflow Registry and
exposes a clean `predict()` function used by both the API and scripts.
"""

import os
import sys
import logging
import joblib
import mlflow
import mlflow.sklearn
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from feature_engineering import prepare_features

log = logging.getLogger(__name__)

ROOT       = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MLFLOW_URI = os.path.join(ROOT, "mlruns")
MODEL_NAME = "fraud-detection-model"
LOCAL_MODEL_PATH = os.path.join(ROOT, "models", "model.pkl")

_model_cache = None  # module-level singleton


def load_model(stage: str = "Production"):
    """
    Load the model from MLflow Registry (Production stage).
    Falls back to the local model.pkl if the registry is unavailable.
    """
    global _model_cache
    if _model_cache is not None:
        return _model_cache

    try:
        mlflow.set_tracking_uri(f"file:///{MLFLOW_URI}")
        model_uri = f"models:/{MODEL_NAME}/{stage}"
        pipeline = mlflow.sklearn.load_model(model_uri)
        log.info(f"✅  Loaded model from MLflow registry: {model_uri}")
    except Exception as exc:
        log.warning(f"MLflow registry unavailable ({exc}), falling back to local model.")
        if not os.path.exists(LOCAL_MODEL_PATH):
            raise FileNotFoundError(
                f"No local model found at {LOCAL_MODEL_PATH}. "
                "Run  python src/train.py  first."
            )
        pipeline = joblib.load(LOCAL_MODEL_PATH)
        log.info(f"Loaded local model from {LOCAL_MODEL_PATH}")

    _model_cache = pipeline
    return pipeline


def get_model_version() -> str:
    """Return the current Production model version from MLflow, or 'local'."""
    try:
        mlflow.set_tracking_uri(f"file:///{MLFLOW_URI}")
        client = mlflow.tracking.MlflowClient()
        versions = client.get_latest_versions(MODEL_NAME, stages=["Production"])
        if versions:
            return f"v{versions[0].version}"
    except Exception:
        pass
    return "local"


def predict(features: dict) -> dict:
    """
    Run inference for a single transaction.

    Parameters
    ----------
    features : dict with keys matching the raw feature columns
        Required: amount, merchant_category, hour_of_day, day_of_week,
                  distance_from_home, prev_transactions

    Returns
    -------
    dict with:
        prediction   : 0 (legit) or 1 (fraud)
        probability  : fraud probability [0.0, 1.0]
        model_version: string
    """
    pipeline = load_model()

    # Build a single-row DataFrame
    row = pd.DataFrame([features])
    X = prepare_features(row)

    pred      = int(pipeline.predict(X)[0])
    prob      = float(pipeline.predict_proba(X)[0][1])

    return {
        "prediction":    pred,
        "probability":   round(prob, 4),
        "model_version": get_model_version(),
    }


def batch_predict(df: pd.DataFrame) -> pd.DataFrame:
    """Run predictions on a DataFrame and return it with prediction columns appended."""
    pipeline = load_model()
    X = prepare_features(df)
    df = df.copy()
    df["predicted_fraud"]       = pipeline.predict(X)
    df["fraud_probability"]     = pipeline.predict_proba(X)[:, 1].round(4)
    df["model_version"]         = get_model_version()
    return df
