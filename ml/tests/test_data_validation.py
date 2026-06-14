"""
test_data_validation.py
───────────────────────
Unit tests for src/data_validation.py

Tests
-----
- Valid data passes all expectations
- Missing required columns → overall fail
- Out-of-range amount → row rejected
- Invalid merchant_category → row rejected
- Invalid is_fraud values → row rejected
- Fraud rate too high → expectation fails
"""

import os
import sys
import pytest
import pandas as pd
import numpy as np
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))
from data_validation import validate, REQUIRED_COLUMNS


def _make_valid_df(n: int = 200) -> pd.DataFrame:
    """Return a clean DataFrame that should pass all validations."""
    np.random.seed(0)
    return pd.DataFrame({
        "transaction_id":     [f"T{i:05d}" for i in range(n)],
        "customer_id":        [f"C{i % 20:04d}" for i in range(n)],
        "amount":             np.random.uniform(1, 999, n).round(2),
        "merchant_category":  np.random.choice(["grocery", "dining", "online"], n),
        "hour_of_day":        np.random.randint(0, 24, n),
        "day_of_week":        np.random.randint(0, 7, n),
        "distance_from_home": np.random.uniform(0.1, 50, n).round(2),
        "prev_transactions":  np.random.randint(0, 10, n),
        "is_fraud":           np.random.choice([0, 1], n, p=[0.95, 0.05]),
        "event_timestamp":    pd.to_datetime([datetime.utcnow()] * n),
    })


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestValidData:
    def test_clean_df_passes(self):
        df = _make_valid_df()
        overall, valid_df, rejected_df = validate(df)
        assert overall is True, "Clean data should pass all validations"

    def test_no_rows_rejected_for_clean_data(self):
        df = _make_valid_df()
        _, valid_df, rejected_df = validate(df)
        assert len(rejected_df) == 0, "No rows should be rejected from clean data"

    def test_valid_row_count(self):
        df = _make_valid_df(100)
        _, valid_df, _ = validate(df)
        assert len(valid_df) == 100


class TestMissingColumns:
    def test_missing_column_fails(self):
        df = _make_valid_df()
        df = df.drop(columns=["amount"])
        overall, _, _ = validate(df)
        assert overall is False, "Missing 'amount' column should fail"

    def test_multiple_missing_columns_fails(self):
        df = _make_valid_df()
        df = df.drop(columns=["amount", "is_fraud"])
        overall, _, _ = validate(df)
        assert overall is False


class TestAmountRange:
    def test_negative_amount_rejected(self):
        df = _make_valid_df()
        df.iloc[0, df.columns.get_loc("amount")] = -10.0
        _, valid_df, rejected_df = validate(df)
        assert "T00000" in rejected_df["transaction_id"].values

    def test_amount_too_high_rejected(self):
        df = _make_valid_df()
        df.iloc[5, df.columns.get_loc("amount")] = 9999.0
        _, _, rejected_df = validate(df)
        assert "T00005" in rejected_df["transaction_id"].values

    def test_boundary_amounts_pass(self):
        df = _make_valid_df()
        df.iloc[0, df.columns.get_loc("amount")] = 0.50   # lower bound
        df.iloc[1, df.columns.get_loc("amount")] = 5000.0  # upper bound
        _, _, rejected_df = validate(df)
        assert "T00000" not in rejected_df["transaction_id"].values
        assert "T00001" not in rejected_df["transaction_id"].values


class TestMerchantCategory:
    def test_invalid_category_rejected(self):
        df = _make_valid_df()
        df.iloc[0, df.columns.get_loc("merchant_category")] = "casino"
        _, _, rejected_df = validate(df)
        assert "T00000" in rejected_df["transaction_id"].values

    def test_valid_categories_pass(self):
        df = _make_valid_df(50)
        # Assign a different valid category to each row
        cats = ["grocery", "electronics", "travel", "dining", "online"] * 10
        df["merchant_category"] = cats
        overall, _, rejected_df = validate(df)
        assert len(rejected_df) == 0


class TestFraudLabel:
    def test_invalid_fraud_value_rejected(self):
        df = _make_valid_df()
        df.iloc[0, df.columns.get_loc("is_fraud")] = 99
        _, _, rejected_df = validate(df)
        assert "T00000" in rejected_df["transaction_id"].values

    def test_fraud_rate_too_high_fails(self):
        df = _make_valid_df(200)
        # Set 50 % fraud rate → should fail expectation
        df["is_fraud"] = ([1] * 100) + ([0] * 100)
        overall, _, _ = validate(df)
        assert overall is False, "50% fraud rate should fail the 1-15% expectation"
