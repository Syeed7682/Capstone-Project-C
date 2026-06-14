"""
api.py
──────
FastAPI Prediction Service for the Fraud Detection ML Platform.

Endpoints
---------
GET  /health      → Health check with model info
POST /predict     → Single transaction fraud prediction
POST /predict/batch → Batch prediction
GET  /metrics     → Request counters and latency stats
GET  /docs        → Auto-generated Swagger UI (built-in)

Start locally
-------------
  uvicorn src.api:app --reload --port 8000
"""

import os
import sys
import time
import logging
import csv
from collections import defaultdict
from datetime import datetime
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

sys.path.insert(0, os.path.dirname(__file__))
from predict import load_model, get_model_version, predict, batch_predict

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

ROOT         = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PREDICTIONS_LOG = os.path.join(ROOT, "data", "predictions_log.csv")

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Fraud Detection API",
    description=(
        "ML Platform Tutorial — Fraud Detection Prediction Service\n\n"
        "Built with scikit-learn + MLflow + FastAPI"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory metrics ─────────────────────────────────────────────────────────
_counters = defaultdict(int)
_latencies: List[float] = []


# ── Pydantic schemas ──────────────────────────────────────────────────────────

VALID_CATEGORIES = {"grocery", "electronics", "travel", "dining", "online"}


class TransactionInput(BaseModel):
    transaction_id:     str   = Field(..., example="txn-001", description="Unique transaction identifier")
    amount:             float = Field(..., gt=0, le=5000, example=150.75, description="Transaction amount in USD")
    merchant_category:  str   = Field(..., example="online", description="One of: grocery, electronics, travel, dining, online")
    hour_of_day:        int   = Field(..., ge=0, le=23, example=14, description="Hour of transaction (0-23)")
    day_of_week:        int   = Field(..., ge=0, le=6, example=2, description="Day of week (0=Mon, 6=Sun)")
    distance_from_home: float = Field(..., ge=0, le=200, example=12.5, description="Distance from home in km")
    prev_transactions:  int   = Field(..., ge=0, le=50, example=3, description="Number of transactions in last 24h")

    @validator("merchant_category")
    def category_must_be_valid(cls, v):
        if v not in VALID_CATEGORIES:
            raise ValueError(f"merchant_category must be one of {VALID_CATEGORIES}")
        return v


class PredictionResponse(BaseModel):
    transaction_id: str
    prediction:     int   = Field(..., description="0=Legitimate, 1=Fraud")
    label:          str   = Field(..., description="'fraud' or 'legitimate'")
    probability:    float = Field(..., description="Fraud probability [0,1]")
    risk_level:     str   = Field(..., description="low / medium / high")
    model_version:  str
    timestamp:      str


class BatchRequest(BaseModel):
    transactions: List[TransactionInput]


class HealthResponse(BaseModel):
    status:        str
    model_name:    str
    model_version: str
    uptime_seconds: float
    timestamp:     str


# ── Startup ───────────────────────────────────────────────────────────────────
_start_time = time.time()
_model_version = "unknown"


@app.on_event("startup")
async def startup_event():
    global _model_version
    log.info("🚀  Starting Fraud Detection API …")
    try:
        load_model()          # warm up model cache
        _model_version = get_model_version()
        log.info(f"✅  Model loaded: {_model_version}")
    except Exception as exc:
        log.warning(f"⚠️  Model not pre-loaded: {exc}")

    # Ensure predictions log file exists
    os.makedirs(os.path.dirname(PREDICTIONS_LOG), exist_ok=True)
    if not os.path.exists(PREDICTIONS_LOG):
        with open(PREDICTIONS_LOG, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp", "transaction_id", "amount", "merchant_category",
                "hour_of_day", "day_of_week", "distance_from_home",
                "prev_transactions", "prediction", "probability", "model_version"
            ])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _risk_level(prob: float) -> str:
    if prob < 0.3:
        return "low"
    elif prob < 0.65:
        return "medium"
    return "high"


def _log_prediction(txn: TransactionInput, pred: int, prob: float, version: str):
    """Append prediction to CSV log for drift monitoring."""
    try:
        with open(PREDICTIONS_LOG, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.utcnow().isoformat(),
                txn.transaction_id, txn.amount, txn.merchant_category,
                txn.hour_of_day, txn.day_of_week, txn.distance_from_home,
                txn.prev_transactions, pred, prob, version
            ])
    except Exception as exc:
        log.warning(f"Failed to log prediction: {exc}")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["Status"])
async def health_check():
    """Health check endpoint — returns model status and uptime."""
    version = get_model_version()
    return HealthResponse(
        status="healthy",
        model_name="fraud-detection-model",
        model_version=version,
        uptime_seconds=round(time.time() - _start_time, 1),
        timestamp=datetime.utcnow().isoformat(),
    )


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict_fraud(transaction: TransactionInput, request: Request):
    """
    Predict whether a transaction is fraudulent.

    - **prediction**: 0 = Legitimate, 1 = Fraud
    - **probability**: Model's confidence [0.0 – 1.0]
    - **risk_level**: low / medium / high
    """
    t0 = time.time()
    _counters["total_requests"] += 1

    try:
        features = {
            "amount":             transaction.amount,
            "merchant_category":  transaction.merchant_category,
            "hour_of_day":        transaction.hour_of_day,
            "day_of_week":        transaction.day_of_week,
            "distance_from_home": transaction.distance_from_home,
            "prev_transactions":  transaction.prev_transactions,
        }
        result = predict(features)

        latency = time.time() - t0
        _latencies.append(latency)
        _counters["fraud_predictions"] += result["prediction"]
        _counters["legit_predictions"] += (1 - result["prediction"])

        _log_prediction(transaction, result["prediction"], result["probability"], result["model_version"])

        return PredictionResponse(
            transaction_id=transaction.transaction_id,
            prediction=result["prediction"],
            label="fraud" if result["prediction"] == 1 else "legitimate",
            probability=result["probability"],
            risk_level=_risk_level(result["probability"]),
            model_version=result["model_version"],
            timestamp=datetime.utcnow().isoformat(),
        )

    except FileNotFoundError as exc:
        _counters["errors"] += 1
        raise HTTPException(status_code=503, detail=f"Model not available: {exc}")
    except Exception as exc:
        _counters["errors"] += 1
        log.error(f"Prediction error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/predict/batch", tags=["Prediction"])
async def predict_batch(batch: BatchRequest):
    """Run predictions on a batch of transactions (max 500)."""
    if len(batch.transactions) > 500:
        raise HTTPException(status_code=400, detail="Batch size cannot exceed 500")

    results = []
    for txn in batch.transactions:
        features = {
            "amount":             txn.amount,
            "merchant_category":  txn.merchant_category,
            "hour_of_day":        txn.hour_of_day,
            "day_of_week":        txn.day_of_week,
            "distance_from_home": txn.distance_from_home,
            "prev_transactions":  txn.prev_transactions,
        }
        result = predict(features)
        _log_prediction(txn, result["prediction"], result["probability"], result["model_version"])
        results.append({
            "transaction_id": txn.transaction_id,
            "prediction":     result["prediction"],
            "label":          "fraud" if result["prediction"] == 1 else "legitimate",
            "probability":    result["probability"],
            "risk_level":     _risk_level(result["probability"]),
        })

    _counters["total_requests"] += len(batch.transactions)
    return {
        "model_version": get_model_version(),
        "count": len(results),
        "results": results,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/metrics", tags=["Status"])
async def get_metrics():
    """Lightweight metrics endpoint (Prometheus-style counters)."""
    avg_latency = (sum(_latencies) / len(_latencies)) if _latencies else 0.0
    p99_latency = sorted(_latencies)[int(0.99 * len(_latencies))] if len(_latencies) >= 100 else avg_latency
    total = _counters["total_requests"]
    fraud_rate = _counters["fraud_predictions"] / total if total > 0 else 0.0

    return {
        "total_requests":    total,
        "fraud_predictions": _counters["fraud_predictions"],
        "legit_predictions": _counters["legit_predictions"],
        "error_count":       _counters["errors"],
        "fraud_rate":        round(fraud_rate, 4),
        "avg_latency_ms":    round(avg_latency * 1000, 2),
        "p99_latency_ms":    round(p99_latency * 1000, 2),
        "uptime_seconds":    round(time.time() - _start_time, 1),
        "model_version":     get_model_version(),
        "timestamp":         datetime.utcnow().isoformat(),
    }


@app.exception_handler(404)
async def not_found(request: Request, exc):
    return JSONResponse(status_code=404, content={
        "error": "Not found",
        "path": str(request.url),
        "docs": "/docs",
    })
