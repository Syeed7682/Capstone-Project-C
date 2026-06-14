"""
test_api.py
───────────
FastAPI endpoint tests using the httpx TestClient.

Tests
-----
GET  /health      → 200, correct fields
POST /predict     → 200, prediction + probability
POST /predict     → 422 on invalid input
POST /predict     → 422 on invalid merchant_category
POST /predict/batch → 200, returns list of results
GET  /metrics     → 200, counters present
GET  /unknown     → 404
"""

import os
import sys
import pytest
import numpy as np

# Ensure train.py has been run before API tests by providing a mock model
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

# ── We monkey-patch load_model so the API tests don't need a trained model ────
import unittest.mock as mock


def _fake_pipeline(X):
    """Always predicts 0 (legit) with 20 % fraud probability."""
    import numpy as np
    n = len(X)
    return np.zeros(n, dtype=int)


class _MockPipeline:
    def predict(self, X):
        return np.zeros(len(X), dtype=int)

    def predict_proba(self, X):
        n = len(X)
        return np.column_stack([np.full(n, 0.8), np.full(n, 0.2)])


@pytest.fixture(scope="module")
def client():
    with mock.patch("predict.load_model", return_value=_MockPipeline()), \
         mock.patch("predict.get_model_version", return_value="v-test"), \
         mock.patch("predict._model_cache", _MockPipeline()):

        from fastapi.testclient import TestClient
        import predict
        predict._model_cache = _MockPipeline()

        from api import app
        return TestClient(app)


VALID_PAYLOAD = {
    "transaction_id":     "test-001",
    "amount":             250.50,
    "merchant_category":  "online",
    "hour_of_day":        14,
    "day_of_week":        2,
    "distance_from_home": 12.5,
    "prev_transactions":  3,
}


# ── Health endpoint ───────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_has_status_field(self, client):
        resp = client.get("/health")
        data = resp.json()
        assert "status" in data
        assert data["status"] == "healthy"

    def test_health_has_model_version(self, client):
        resp = client.get("/health")
        assert "model_version" in resp.json()

    def test_health_has_timestamp(self, client):
        resp = client.get("/health")
        assert "timestamp" in resp.json()


# ── Predict endpoint ──────────────────────────────────────────────────────────

class TestPredictEndpoint:
    def test_valid_request_returns_200(self, client):
        resp = client.post("/predict", json=VALID_PAYLOAD)
        assert resp.status_code == 200

    def test_response_has_prediction_field(self, client):
        resp = client.post("/predict", json=VALID_PAYLOAD)
        data = resp.json()
        assert "prediction" in data
        assert data["prediction"] in [0, 1]

    def test_response_has_probability(self, client):
        resp = client.post("/predict", json=VALID_PAYLOAD)
        data = resp.json()
        assert "probability" in data
        assert 0.0 <= data["probability"] <= 1.0

    def test_response_has_risk_level(self, client):
        resp = client.post("/predict", json=VALID_PAYLOAD)
        data = resp.json()
        assert "risk_level" in data
        assert data["risk_level"] in ["low", "medium", "high"]

    def test_response_has_label(self, client):
        resp = client.post("/predict", json=VALID_PAYLOAD)
        data = resp.json()
        assert "label" in data
        assert data["label"] in ["fraud", "legitimate"]

    def test_response_echoes_transaction_id(self, client):
        resp = client.post("/predict", json=VALID_PAYLOAD)
        assert resp.json()["transaction_id"] == "test-001"


class TestPredictValidation:
    def test_missing_amount_returns_422(self, client):
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "amount"}
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 422

    def test_invalid_merchant_category_returns_422(self, client):
        payload = {**VALID_PAYLOAD, "merchant_category": "casino"}
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 422

    def test_amount_too_large_returns_422(self, client):
        payload = {**VALID_PAYLOAD, "amount": 99999.0}
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 422

    def test_negative_amount_returns_422(self, client):
        payload = {**VALID_PAYLOAD, "amount": -5.0}
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 422

    def test_hour_out_of_range_returns_422(self, client):
        payload = {**VALID_PAYLOAD, "hour_of_day": 25}
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 422


# ── Batch endpoint ────────────────────────────────────────────────────────────

class TestBatchEndpoint:
    def test_batch_returns_200(self, client):
        payload = {"transactions": [VALID_PAYLOAD, {**VALID_PAYLOAD, "transaction_id": "test-002"}]}
        resp = client.post("/predict/batch", json=payload)
        assert resp.status_code == 200

    def test_batch_result_count_matches_input(self, client):
        txns = [{**VALID_PAYLOAD, "transaction_id": f"t-{i}"} for i in range(5)]
        resp = client.post("/predict/batch", json={"transactions": txns})
        assert resp.json()["count"] == 5

    def test_batch_too_large_returns_400(self, client):
        txns = [{**VALID_PAYLOAD, "transaction_id": f"t-{i}"} for i in range(501)]
        resp = client.post("/predict/batch", json={"transactions": txns})
        assert resp.status_code == 400


# ── Metrics endpoint ──────────────────────────────────────────────────────────

class TestMetricsEndpoint:
    def test_metrics_returns_200(self, client):
        resp = client.get("/metrics")
        assert resp.status_code == 200

    def test_metrics_has_required_fields(self, client):
        resp = client.get("/metrics")
        data = resp.json()
        for field in ["total_requests", "fraud_rate", "avg_latency_ms", "uptime_seconds"]:
            assert field in data, f"Missing field: {field}"


# ── 404 handler ───────────────────────────────────────────────────────────────

class TestNotFound:
    def test_unknown_route_returns_404(self, client):
        resp = client.get("/nonexistent-route")
        assert resp.status_code == 404
