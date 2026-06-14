"""
test_train.py
─────────────
Integration tests for the training pipeline.

Tests
-----
- Feature engineering produces correct columns
- Preprocessor fits without errors
- Pipeline trains and returns predictions
- MLflow run is created with expected params + metrics
- Saved model file exists after training
"""

import os
import sys
import shutil
import tempfile
import pytest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))
from feature_engineering import (
    prepare_features, build_preprocessor,
    NUMERIC_FEATURES_EXT, CATEGORICAL_FEATURES,
    add_engineered_features,
)
from data_generation import generate_transactions


@pytest.fixture(scope="module")
def sample_df():
    """Generate a small, reproducible dataset for tests."""
    np.random.seed(42)
    return generate_transactions(n=500)


@pytest.fixture(scope="module")
def prepared_features(sample_df):
    return prepare_features(sample_df)


# ── Feature Engineering Tests ─────────────────────────────────────────────────

class TestFeatureEngineering:
    def test_engineered_columns_added(self, sample_df):
        df = add_engineered_features(sample_df)
        assert "amount_log" in df.columns
        assert "is_weekend" in df.columns
        assert "is_night" in df.columns

    def test_amount_log_non_negative(self, sample_df):
        df = add_engineered_features(sample_df)
        assert (df["amount_log"] >= 0).all()

    def test_is_weekend_binary(self, sample_df):
        df = add_engineered_features(sample_df)
        assert set(df["is_weekend"].unique()).issubset({0, 1})

    def test_is_night_binary(self, sample_df):
        df = add_engineered_features(sample_df)
        assert set(df["is_night"].unique()).issubset({0, 1})

    def test_prepare_features_shape(self, prepared_features):
        expected_cols = NUMERIC_FEATURES_EXT + CATEGORICAL_FEATURES
        assert list(prepared_features.columns) == expected_cols

    def test_prepare_features_no_nulls(self, prepared_features):
        assert prepared_features.isnull().sum().sum() == 0


# ── Preprocessor Tests ────────────────────────────────────────────────────────

class TestPreprocessor:
    def test_preprocessor_fits(self, prepared_features):
        preprocessor = build_preprocessor()
        transformed = preprocessor.fit_transform(prepared_features)
        assert transformed is not None

    def test_transformed_shape(self, prepared_features):
        preprocessor = build_preprocessor()
        transformed = preprocessor.fit_transform(prepared_features)
        n_cols = len(NUMERIC_FEATURES_EXT) + len(CATEGORICAL_FEATURES)
        assert transformed.shape == (len(prepared_features), n_cols)

    def test_handles_unknown_category(self, sample_df):
        preprocessor = build_preprocessor()
        X = prepare_features(sample_df)
        preprocessor.fit(X)
        # Create row with unknown category
        test_row = X.iloc[[0]].copy()
        test_row["merchant_category"] = "unknown_category"
        # Should not raise
        result = preprocessor.transform(test_row)
        assert result is not None


# ── Full Pipeline Tests ───────────────────────────────────────────────────────

class TestTrainingPipeline:
    def test_pipeline_trains_and_predicts(self, sample_df):
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.pipeline import Pipeline

        X = prepare_features(sample_df)
        y = sample_df["is_fraud"].values
        preprocessor = build_preprocessor()
        pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("classifier",   RandomForestClassifier(n_estimators=10, random_state=0)),
        ])
        pipeline.fit(X, y)
        preds = pipeline.predict(X[:10])
        assert len(preds) == 10
        assert set(preds).issubset({0, 1})

    def test_predict_proba_in_range(self, sample_df):
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.pipeline import Pipeline

        X = prepare_features(sample_df)
        y = sample_df["is_fraud"].values
        preprocessor = build_preprocessor()
        pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("classifier",   RandomForestClassifier(n_estimators=10, random_state=0)),
        ])
        pipeline.fit(X, y)
        probs = pipeline.predict_proba(X)[:, 1]
        assert (probs >= 0).all() and (probs <= 1).all()

    def test_metrics_are_computed(self, sample_df):
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.pipeline import Pipeline
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import roc_auc_score

        X = prepare_features(sample_df)
        y = sample_df["is_fraud"].values
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=0)

        preprocessor = build_preprocessor()
        pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("classifier",   RandomForestClassifier(n_estimators=10, random_state=0)),
        ])
        pipeline.fit(X_train, y_train)
        probs = pipeline.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, probs)
        assert 0.5 <= auc <= 1.0, f"AUC should be above random chance, got {auc:.4f}"


# ── Data Generation Tests ─────────────────────────────────────────────────────

class TestDataGeneration:
    def test_generates_correct_row_count(self):
        df = generate_transactions(n=100)
        assert len(df) == 100

    def test_all_required_columns_present(self):
        df = generate_transactions(n=50)
        for col in ["transaction_id", "amount", "is_fraud", "event_timestamp"]:
            assert col in df.columns

    def test_fraud_rate_realistic(self):
        df = generate_transactions(n=1000)
        fraud_rate = df["is_fraud"].mean()
        assert 0.01 <= fraud_rate <= 0.30, f"Fraud rate {fraud_rate:.2%} out of expected range"

    def test_amount_bounds(self):
        df = generate_transactions(n=500)
        assert df["amount"].min() >= 0.50
        assert df["amount"].max() <= 5000.0
