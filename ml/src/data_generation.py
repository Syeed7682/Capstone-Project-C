"""
data_generation.py
──────────────────
Generates a synthetic fraud-detection transaction dataset and writes it to
data/raw/transactions.csv.

Features
--------
transaction_id      : unique UUID
customer_id         : customer identifier (100 unique customers)
amount              : transaction amount in USD (0.50 – 5000)
merchant_category   : one of {grocery, electronics, travel, dining, online}
hour_of_day         : 0-23
day_of_week         : 0-6  (0=Monday)
distance_from_home  : km (0.1 – 200)
prev_transactions   : number of transactions in last 24 h (0-15)
is_fraud            : binary label  (~4 % fraud rate)
event_timestamp     : ISO-8601 timestamp (needed by Feast)
"""

import os
import uuid
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ── Reproducibility ──────────────────────────────────────────────────────────
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

N_SAMPLES = 10_000
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "transactions.csv")

MERCHANT_CATEGORIES = ["grocery", "electronics", "travel", "dining", "online"]


def _fraud_probability(amount: np.ndarray, distance: np.ndarray,
                       hour: np.ndarray, category: np.ndarray) -> np.ndarray:
    """Deterministic-ish fraud probability to create realistic label correlations."""
    score = np.zeros(len(amount))

    # High amounts are riskier
    score += np.where(amount > 1000, 0.25, 0.0)
    score += np.where(amount > 2500, 0.25, 0.0)

    # Far-from-home transactions are riskier
    score += np.where(distance > 100, 0.20, 0.0)

    # Night-time transactions (0-5 h) are slightly riskier
    score += np.where((hour >= 0) & (hour <= 5), 0.15, 0.0)

    # Online & travel categories have higher base fraud rate
    score += np.where(np.isin(category, ["online", "travel"]), 0.10, 0.0)

    # Clip to sensible range and add noise
    score = np.clip(score, 0.01, 0.75)
    noise = np.random.uniform(-0.02, 0.02, size=len(amount))
    return np.clip(score + noise, 0.0, 1.0)


def generate_transactions(n: int = N_SAMPLES) -> pd.DataFrame:
    """Return a DataFrame of synthetic transactions."""
    now = datetime.utcnow()

    transaction_ids = [str(uuid.uuid4()) for _ in range(n)]
    customer_ids    = [f"C{np.random.randint(1, 101):04d}" for _ in range(n)]

    # Amounts: mostly small, long right tail (log-normal)
    amounts = np.round(np.random.lognormal(mean=4.5, sigma=1.2, size=n), 2)
    amounts = np.clip(amounts, 0.50, 5000.0)

    categories   = np.random.choice(MERCHANT_CATEGORIES, size=n)
    hours        = np.random.randint(0, 24, size=n)
    days         = np.random.randint(0, 7, size=n)
    distances    = np.round(np.random.exponential(scale=20, size=n), 2)
    distances    = np.clip(distances, 0.1, 200.0)
    prev_txns    = np.random.randint(0, 16, size=n)

    # Generate labels using correlated probability
    fraud_probs  = _fraud_probability(amounts, distances, hours, categories)
    is_fraud     = (np.random.uniform(size=n) < fraud_probs).astype(int)

    # Timestamps spread over the last 90 days
    seconds_back = np.random.randint(0, 90 * 86400, size=n)
    timestamps   = [now - timedelta(seconds=int(s)) for s in seconds_back]

    df = pd.DataFrame({
        "transaction_id":     transaction_ids,
        "customer_id":        customer_ids,
        "amount":             amounts,
        "merchant_category":  categories,
        "hour_of_day":        hours,
        "day_of_week":        days,
        "distance_from_home": distances,
        "prev_transactions":  prev_txns,
        "is_fraud":           is_fraud,
        "event_timestamp":    pd.to_datetime(timestamps).round("s"),
    })

    return df


def save_transactions(df: pd.DataFrame, path: str = OUTPUT_PATH) -> str:
    """Save the DataFrame to CSV and return the absolute path."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    abs_path = os.path.abspath(path)
    df.to_csv(abs_path, index=False)
    return abs_path


def main() -> None:
    print("🔄  Generating synthetic transaction data …")
    df = generate_transactions()
    path = save_transactions(df)

    fraud_rate = df["is_fraud"].mean() * 100
    print(f"✅  {len(df):,} transactions written to: {path}")
    print(f"    Fraud rate : {fraud_rate:.2f}%")
    print(f"    Amount range: ${df['amount'].min():.2f} – ${df['amount'].max():.2f}")
    print(f"    Date range  : {df['event_timestamp'].min()} → {df['event_timestamp'].max()}")


if __name__ == "__main__":
    main()
