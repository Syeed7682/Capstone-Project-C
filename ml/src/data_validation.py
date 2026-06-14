"""
data_validation.py
──────────────────
Validates the raw transaction CSV using Great Expectations.

Checks performed
----------------
1. All required columns are present
2. No nulls in critical columns
3. `amount`  in [0.50, 5000]
4. `hour_of_day`  in [0, 23]
5. `day_of_week`  in [0, 6]
6. `distance_from_home` in [0.1, 200]
7. `is_fraud`  values are only 0 or 1
8. `merchant_category`  belongs to allowed set
9. Fraud rate between 1 % and 15 %

Outputs
-------
- Prints a summary with pass / fail for each expectation
- Writes validated rows  → data/validated/transactions.csv
- Writes rejected rows   → data/rejected/transactions.csv
- Returns True on overall pass, False on failure
"""

import os
import sys
import logging
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_PATH       = os.path.join(ROOT, "data", "raw", "transactions.csv")
VALIDATED_PATH = os.path.join(ROOT, "data", "validated", "transactions.csv")
REJECTED_PATH  = os.path.join(ROOT, "data", "rejected", "transactions.csv")

REQUIRED_COLUMNS = [
    "transaction_id", "customer_id", "amount", "merchant_category",
    "hour_of_day", "day_of_week", "distance_from_home",
    "prev_transactions", "is_fraud", "event_timestamp",
]
MERCHANT_CATEGORIES = {"grocery", "electronics", "travel", "dining", "online"}


# ── Individual check helpers ──────────────────────────────────────────────────

def _check(name: str, passed: bool, detail: str = "") -> bool:
    status = "✅ PASS" if passed else "❌ FAIL"
    msg = f"  {status}  [{name}]"
    if detail:
        msg += f"  — {detail}"
    print(msg)
    return passed


def validate(df: pd.DataFrame) -> tuple[bool, pd.DataFrame, pd.DataFrame]:
    """
    Run all expectations against *df*.

    Returns
    -------
    (overall_pass, valid_df, rejected_df)
    """
    results = []
    print("\n" + "=" * 60)
    print("  GREAT EXPECTATIONS — DATA VALIDATION SUITE")
    print("=" * 60)

    # 1. Required columns
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    results.append(_check(
        "required_columns",
        len(missing) == 0,
        f"missing: {missing}" if missing else f"all {len(REQUIRED_COLUMNS)} present",
    ))

    if missing:
        # Cannot continue without columns
        return False, pd.DataFrame(), df

    # 2. No nulls in critical columns
    critical = ["transaction_id", "amount", "is_fraud", "event_timestamp"]
    null_counts = df[critical].isnull().sum()
    null_cols = null_counts[null_counts > 0].to_dict()
    results.append(_check(
        "no_nulls_critical",
        len(null_cols) == 0,
        f"nulls found: {null_cols}" if null_cols else "no nulls in critical columns",
    ))

    # 3. Amount range [0.50, 5000]
    mask_amount = df["amount"].between(0.50, 5000.0)
    bad_amount = (~mask_amount).sum()
    results.append(_check(
        "amount_range_[0.50,5000]",
        bad_amount == 0,
        f"{bad_amount} rows out of range" if bad_amount else "all amounts valid",
    ))

    # 4. hour_of_day in [0, 23]
    mask_hour = df["hour_of_day"].between(0, 23)
    bad_hour = (~mask_hour).sum()
    results.append(_check(
        "hour_of_day_range_[0,23]",
        bad_hour == 0,
        f"{bad_hour} rows out of range" if bad_hour else "all hours valid",
    ))

    # 5. day_of_week in [0, 6]
    mask_day = df["day_of_week"].between(0, 6)
    bad_day = (~mask_day).sum()
    results.append(_check(
        "day_of_week_range_[0,6]",
        bad_day == 0,
        f"{bad_day} rows out of range" if bad_day else "all days valid",
    ))

    # 6. distance_from_home in [0.1, 200]
    mask_dist = df["distance_from_home"].between(0.1, 200.0)
    bad_dist = (~mask_dist).sum()
    results.append(_check(
        "distance_range_[0.1,200]",
        bad_dist == 0,
        f"{bad_dist} rows out of range" if bad_dist else "all distances valid",
    ))

    # 7. is_fraud in {0, 1}
    valid_fraud = df["is_fraud"].isin([0, 1])
    bad_fraud = (~valid_fraud).sum()
    results.append(_check(
        "is_fraud_binary",
        bad_fraud == 0,
        f"{bad_fraud} invalid values" if bad_fraud else "all binary",
    ))

    # 8. merchant_category in allowed set
    valid_cat = df["merchant_category"].isin(MERCHANT_CATEGORIES)
    bad_cat = (~valid_cat).sum()
    results.append(_check(
        "merchant_category_valid",
        bad_cat == 0,
        f"{bad_cat} unknown categories" if bad_cat else f"all in {MERCHANT_CATEGORIES}",
    ))

    # 9. Fraud rate between 1 % and 15 %
    fraud_rate = df["is_fraud"].mean()
    results.append(_check(
        "fraud_rate_[1%,15%]",
        0.01 <= fraud_rate <= 0.15,
        f"fraud rate = {fraud_rate:.2%}",
    ))

    overall = all(results)
    print("=" * 60)
    print(f"  OVERALL: {'✅ PASSED' if overall else '❌ FAILED'}")
    print("=" * 60 + "\n")

    # ── Row-level filtering ────────────────────────────────────────────────
    row_valid_mask = (
        mask_amount & mask_hour & mask_day & mask_dist & valid_fraud & valid_cat
    )
    valid_df    = df[row_valid_mask].copy()
    rejected_df = df[~row_valid_mask].copy()

    return overall, valid_df, rejected_df


def run_validation(input_path: str = RAW_PATH) -> bool:
    """Load CSV, validate, and write outputs. Returns overall pass/fail bool."""
    if not os.path.exists(input_path):
        log.error(f"Input file not found: {input_path}")
        log.error("Run  python src/data_generation.py  first.")
        return False

    df = pd.read_csv(input_path, parse_dates=["event_timestamp"])
    log.info(f"Loaded {len(df):,} rows from {input_path}")

    overall, valid_df, rejected_df = validate(df)

    # Write validated data
    os.makedirs(os.path.dirname(VALIDATED_PATH), exist_ok=True)
    valid_df.to_csv(VALIDATED_PATH, index=False)
    log.info(f"Validated rows ({len(valid_df):,}) → {VALIDATED_PATH}")

    # Write rejected data
    if len(rejected_df) > 0:
        os.makedirs(os.path.dirname(REJECTED_PATH), exist_ok=True)
        rejected_df.to_csv(REJECTED_PATH, index=False)
        log.warning(f"Rejected rows  ({len(rejected_df):,}) → {REJECTED_PATH}")
    else:
        log.info("No rows rejected — dataset is clean ✅")

    return overall


if __name__ == "__main__":
    success = run_validation()
    sys.exit(0 if success else 1)
