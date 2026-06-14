"""
feature_engineering.py
───────────────────────
Shared feature transformation logic used by both the training pipeline and
the FastAPI serving layer.  Keeps preprocessing DRY and consistent.

Numeric features   : amount, distance_from_home, prev_transactions
Categorical features: merchant_category
Engineered features : amount_log (log1p of amount)
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, OrdinalEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer

# ── Column groups ─────────────────────────────────────────────────────────────
NUMERIC_FEATURES = [
    "amount",
    "distance_from_home",
    "prev_transactions",
    "hour_of_day",
    "day_of_week",
]

CATEGORICAL_FEATURES = ["merchant_category"]

MERCHANT_CATEGORIES = ["grocery", "electronics", "travel", "dining", "online"]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

TARGET_COLUMN = "is_fraud"


# ── Feature engineering helpers ───────────────────────────────────────────────

def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived features in-place and return the mutated DataFrame."""
    df = df.copy()
    # log-transform skewed amount
    df["amount_log"] = np.log1p(df["amount"])
    # weekend flag
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    # night flag
    df["is_night"] = ((df["hour_of_day"] >= 22) | (df["hour_of_day"] <= 5)).astype(int)
    return df


NUMERIC_FEATURES_EXT = NUMERIC_FEATURES + ["amount_log", "is_weekend", "is_night"]


def build_preprocessor() -> ColumnTransformer:
    """
    Return a scikit-learn ColumnTransformer that:
    - StandardScales all numeric features
    - OrdinalEncodes categorical features
    """
    numeric_pipeline = Pipeline([
        ("scaler", StandardScaler()),
    ])

    categorical_pipeline = Pipeline([
        ("encoder", OrdinalEncoder(
            categories=[MERCHANT_CATEGORIES],
            handle_unknown="use_encoded_value",
            unknown_value=-1,
        )),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, NUMERIC_FEATURES_EXT),
            ("cat", categorical_pipeline, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )
    return preprocessor


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add engineered features and return only the feature columns needed for
    the preprocessor."""
    df = add_engineered_features(df)
    return df[NUMERIC_FEATURES_EXT + CATEGORICAL_FEATURES]
