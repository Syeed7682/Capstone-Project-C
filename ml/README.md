# ML Platform Tutorial 🚀

A **production-grade ML platform** for fraud detection built with:

`scikit-learn` · `MLflow` · `Feast` · `FastAPI` · `Evidently` · `Docker` · `GitHub Actions`

---

## Architecture

```
Raw Data → Great Expectations → Feast Feature Store
                                        ↓
                           scikit-learn Training Pipeline
                                        ↓
                               MLflow Tracking + Registry
                                        ↓
                            FastAPI Prediction Service
                            POST /predict  |  GET /health
                                        ↓
                           Evidently Monitoring (Drift Alerts)
```

## Project Structure

```
ml-platform-tutorial/
├── data/
│   ├── raw/                    # Generated transaction CSV
│   ├── validated/              # GE-validated data
│   ├── feast/                  # Parquet for Feast offline store
│   ├── reference/              # Evidently baseline
│   ├── monitoring_reports/     # Drift JSON reports
│   └── alerts/                 # Alert JSON files
├── models/                     # Saved model.pkl (local copy)
├── mlruns/                     # MLflow tracking data
├── src/
│   ├── data_generation.py      # Synthetic data (10K transactions)
│   ├── data_validation.py      # Great Expectations-style checks
│   ├── feature_engineering.py  # Shared transforms (train + serve)
│   ├── train.py                # scikit-learn + MLflow pipeline
│   ├── predict.py              # Inference helper
│   ├── api.py                  # FastAPI serving layer
│   └── monitoring.py           # Evidently drift detection
├── tests/
│   ├── test_data_validation.py
│   ├── test_train.py
│   └── test_api.py
├── feature_repo/               # Feast feature repository
│   ├── feature_store.yaml
│   ├── data_sources.py
│   └── features.py
├── Dockerfile                  # Multi-stage container build
├── docker-compose.yml          # Local MLflow + API stack
├── .github/workflows/ci_cd.yml # GitHub Actions pipeline
└── requirements.txt
```

---

## Quick Start

### 1. Set up virtual environment

```bash
cd ml-platform-tutorial
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
```

### 2. Generate & validate data

```bash
python src/data_generation.py      # → data/raw/transactions.csv
python src/data_validation.py      # → data/validated/transactions.csv
```

### 3. Set up Feast feature store

```bash
cd feature_repo
feast apply                        # Register feature views
feast materialize-incremental $(date -u +%Y-%m-%dT%H:%M:%S)
cd ..
```

### 4. Train the model

```bash
python src/train.py
# View results in MLflow UI:
mlflow ui --backend-store-uri mlruns
# Open: http://localhost:5000
```

### 5. Start the API

```bash
uvicorn src.api:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### 6. Make a prediction

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn-test-001",
    "amount": 850.00,
    "merchant_category": "online",
    "hour_of_day": 2,
    "day_of_week": 6,
    "distance_from_home": 150.0,
    "prev_transactions": 0
  }'
```

### 7. Run monitoring

```bash
python src/monitoring.py --window-days 30
```

### 8. Run tests

```bash
pytest tests/ -v
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` | Health check + model version |
| `POST` | `/predict` | Single transaction fraud prediction |
| `POST` | `/predict/batch` | Batch predictions (max 500) |
| `GET`  | `/metrics` | Request counters + latency stats |
| `GET`  | `/docs` | Swagger UI |

### Example Response

```json
{
  "transaction_id": "txn-test-001",
  "prediction": 1,
  "label": "fraud",
  "probability": 0.8723,
  "risk_level": "high",
  "model_version": "v3",
  "timestamp": "2024-01-15T14:30:00.000000"
}
```

---

## Docker

```bash
# Build
docker build -t fraud-detection-api .

# Run full stack (API + MLflow)
docker-compose up

# Services:
#   FastAPI  → http://localhost:8000
#   MLflow   → http://localhost:5000
```

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci_cd.yml`) runs:

```
Checkout → Install → Generate Data → Train → Test → Build Docker → Deploy
```

**Triggers:** push to `main`/`develop`, pull requests to `main`

---

## Monitoring & Alerts

The Evidently-style monitoring (`src/monitoring.py`) computes:

- **PSI** (Population Stability Index) for numeric features
- **Chi-square drift** for categorical features
- **Prediction drift** detection

If `> 30%` of features drift, a **drift alert** JSON is written to `data/alerts/` and a `RETRAIN` warning is logged.

---

## Tech Stack

| Component | Tool | Version |
|-----------|------|---------|
| Model Training | scikit-learn | 1.5.0 |
| Experiment Tracking | MLflow | 2.13.0 |
| Feature Store | Feast | 0.40.0 |
| Data Validation | Great Expectations | 0.18.19 |
| API Serving | FastAPI | 0.111.0 |
| ML Monitoring | Evidently | 0.4.30 |
| Testing | pytest | 8.2.0 |
| Container | Docker | — |
| CI/CD | GitHub Actions | — |
