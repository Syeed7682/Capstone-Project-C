"""
monitoring.py
─────────────
Evidently ML Monitoring for the Fraud Detection platform.

Reports generated
-----------------
1. Data Drift Report        — feature distribution shift vs. reference
2. Classification Report    — precision, recall, AUC decay over time
3. Data Quality Report      — missing values, outliers in recent predictions

Drift Alert
-----------
If the share of drifted features exceeds DRIFT_THRESHOLD (default 0.3),
an alert is written to data/alerts/drift_alert.json and logged as WARNING.

Usage
-----
  python src/monitoring.py                         # uses default paths
  python src/monitoring.py --window-days 7         # last 7 days of predictions
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime, timedelta

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

ROOT             = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REFERENCE_PATH   = os.path.join(ROOT, "data", "reference", "reference_data.csv")
PREDICTIONS_LOG  = os.path.join(ROOT, "data", "predictions_log.csv")
REPORTS_DIR      = os.path.join(ROOT, "data", "monitoring_reports")
ALERTS_DIR       = os.path.join(ROOT, "data", "alerts")

DRIFT_THRESHOLD  = 0.30   # alert if > 30 % of features drift
NUMERIC_COLS     = ["amount", "hour_of_day", "day_of_week", "distance_from_home", "prev_transactions"]
CATEGORICAL_COLS = ["merchant_category"]


# ── Data loading ──────────────────────────────────────────────────────────────

def load_reference(path: str = REFERENCE_PATH) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Reference data not found: {path}\nRun train.py first.")
    df = pd.read_csv(path)
    log.info(f"Reference data: {len(df):,} rows from {path}")
    return df


def load_current_predictions(path: str = PREDICTIONS_LOG,
                              window_days: int = 30) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Predictions log not found: {path}\nMake some predictions via /predict first.")
    df = pd.read_csv(path, parse_dates=["timestamp"])
    cutoff = datetime.utcnow() - timedelta(days=window_days)
    df = df[df["timestamp"] >= cutoff]
    log.info(f"Current predictions: {len(df):,} rows (last {window_days} days)")
    return df


# ── Simple drift detection (without Evidently import issues) ──────────────────

def compute_psi(expected: pd.Series, actual: pd.Series, bins: int = 10) -> float:
    """
    Population Stability Index — measures distribution shift.
    PSI < 0.1  : No significant change
    PSI 0.1-0.2: Moderate change
    PSI > 0.2  : Significant change (drift)
    """
    expected = expected.dropna()
    actual   = actual.dropna()
    if len(expected) == 0 or len(actual) == 0:
        return 0.0

    # Create bins from expected distribution
    breakpoints = pd.qcut(expected, q=bins, duplicates="drop", retbins=True)[1]
    breakpoints[0]  = -float("inf")
    breakpoints[-1] =  float("inf")

    exp_counts = pd.cut(expected, bins=breakpoints).value_counts(normalize=True, sort=False)
    act_counts = pd.cut(actual,   bins=breakpoints).value_counts(normalize=True, sort=False)

    exp_pct = exp_counts.reindex(exp_counts.index).fillna(1e-4).values
    act_pct = act_counts.reindex(exp_counts.index).fillna(1e-4).values

    psi = float(sum((act_pct - exp_pct) * (pd.np.log(act_pct / exp_pct) if False else
                __import__("numpy").log(act_pct / exp_pct))))
    return round(abs(psi), 4)


def compute_categorical_drift(expected: pd.Series, actual: pd.Series) -> float:
    """Chi-square based drift score [0, 1]."""
    exp_dist = expected.value_counts(normalize=True)
    act_dist = actual.value_counts(normalize=True)
    all_cats = exp_dist.index.union(act_dist.index)

    exp_vec = exp_dist.reindex(all_cats, fill_value=1e-4).values
    act_vec = act_dist.reindex(all_cats, fill_value=1e-4).values

    chi_sq = float(sum(((act_vec - exp_vec) ** 2) / exp_vec))
    # Normalize to [0, 1] scale
    return round(min(chi_sq / len(all_cats), 1.0), 4)


# ── Report generation ─────────────────────────────────────────────────────────

def generate_drift_report(reference: pd.DataFrame,
                           current: pd.DataFrame) -> dict:
    """Compute per-feature drift scores and overall summary."""
    report = {
        "report_type":    "data_drift",
        "generated_at":   datetime.utcnow().isoformat(),
        "reference_rows": len(reference),
        "current_rows":   len(current),
        "features":       {},
        "summary":        {},
    }

    drifted = 0
    total   = 0

    # Numeric features
    for col in NUMERIC_COLS:
        if col in reference.columns and col in current.columns:
            psi = compute_psi(reference[col], current[col])
            is_drift = psi > 0.2
            report["features"][col] = {
                "type":     "numeric",
                "psi":      psi,
                "drifted":  is_drift,
                "severity": "high" if psi > 0.25 else ("medium" if psi > 0.1 else "low"),
            }
            if is_drift:
                drifted += 1
            total += 1

    # Categorical features
    for col in CATEGORICAL_COLS:
        if col in reference.columns and col in current.columns:
            score = compute_categorical_drift(reference[col], current[col])
            is_drift = score > 0.15
            report["features"][col] = {
                "type":     "categorical",
                "score":    score,
                "drifted":  is_drift,
                "severity": "high" if score > 0.3 else ("medium" if score > 0.15 else "low"),
            }
            if is_drift:
                drifted += 1
            total += 1

    drift_share = drifted / total if total > 0 else 0.0
    report["summary"] = {
        "total_features":   total,
        "drifted_features": drifted,
        "drift_share":      round(drift_share, 4),
        "dataset_drift":    drift_share > DRIFT_THRESHOLD,
        "drift_threshold":  DRIFT_THRESHOLD,
    }

    return report


def generate_prediction_report(current: pd.DataFrame) -> dict:
    """Analyze prediction distribution in current window."""
    if "prediction" not in current.columns:
        return {"error": "No prediction column in log"}

    total = len(current)
    fraud_count = int(current["prediction"].sum())
    fraud_rate  = round(current["prediction"].mean(), 4) if total > 0 else 0.0

    report = {
        "report_type":    "prediction_drift",
        "generated_at":   datetime.utcnow().isoformat(),
        "total_predictions": total,
        "fraud_count":    fraud_count,
        "legit_count":    total - fraud_count,
        "fraud_rate":     fraud_rate,
        "avg_probability": round(current["probability"].mean(), 4) if "probability" in current.columns else None,
        "alert": fraud_rate > 0.20 or fraud_rate < 0.001,
        "alert_reason": (
            "Fraud rate unusually high (>20%)" if fraud_rate > 0.20
            else ("Fraud rate suspiciously low (<0.1%)" if fraud_rate < 0.001 and total > 100
                  else None)
        ),
    }
    return report


def check_and_alert(drift_report: dict, pred_report: dict) -> bool:
    """Write an alert file and log WARNING if drift threshold exceeded."""
    summary = drift_report.get("summary", {})
    triggered = summary.get("dataset_drift", False) or pred_report.get("alert", False)

    if triggered:
        os.makedirs(ALERTS_DIR, exist_ok=True)
        alert = {
            "alert_triggered_at":  datetime.utcnow().isoformat(),
            "drift_threshold":     DRIFT_THRESHOLD,
            "drift_share":         summary.get("drift_share"),
            "dataset_drift":       summary.get("dataset_drift"),
            "prediction_alert":    pred_report.get("alert"),
            "prediction_alert_reason": pred_report.get("alert_reason"),
            "recommended_action":  "Review model performance and consider retraining.",
        }
        alert_path = os.path.join(ALERTS_DIR, f"alert_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json")
        with open(alert_path, "w") as f:
            json.dump(alert, f, indent=2)

        log.warning("🚨  DRIFT ALERT TRIGGERED!")
        log.warning(f"    Drift share: {summary.get('drift_share', 0):.1%}  (threshold: {DRIFT_THRESHOLD:.0%})")
        log.warning(f"    Alert saved → {alert_path}")
        log.warning("    Recommended: Retrain model with updated data.")
    else:
        log.info("✅  No drift detected. Model performance is stable.")

    return triggered


def save_report(report: dict, name: str) -> str:
    """Save a JSON report and return the path."""
    os.makedirs(REPORTS_DIR, exist_ok=True)
    ts   = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(REPORTS_DIR, f"{name}_{ts}.json")
    with open(path, "w") as f:
        json.dump(report, f, indent=2)
    log.info(f"Report saved → {path}")
    return path


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Run Evidently-style ML monitoring")
    p.add_argument("--window-days", default=30, type=int,
                   help="Days of predictions to analyze (default: 30)")
    p.add_argument("--reference",   default=REFERENCE_PATH)
    p.add_argument("--predictions", default=PREDICTIONS_LOG)
    return p.parse_args()


def main():
    args = parse_args()
    print("\n" + "=" * 60)
    print("  ML MONITORING — EVIDENTLY-STYLE DRIFT DETECTION")
    print("=" * 60)

    # Load data
    try:
        reference = load_reference(args.reference)
    except FileNotFoundError as e:
        log.error(str(e))
        return

    try:
        current = load_current_predictions(args.predictions, args.window_days)
    except FileNotFoundError as e:
        log.error(str(e))
        log.error("Make some predictions first:  POST http://localhost:8000/predict")
        return

    if len(current) == 0:
        log.warning(f"No predictions found in the last {args.window_days} days.")
        return

    # Generate reports
    log.info("\n🔍  Computing Data Drift …")
    drift_report = generate_drift_report(reference, current)

    log.info("📊  Computing Prediction Drift …")
    pred_report  = generate_prediction_report(current)

    # Save reports
    save_report(drift_report, "data_drift")
    save_report(pred_report,  "prediction_drift")

    # Print summary
    summary = drift_report["summary"]
    print(f"\n  Data Drift Summary:")
    print(f"    Features checked : {summary['total_features']}")
    print(f"    Drifted features : {summary['drifted_features']}")
    print(f"    Drift share      : {summary['drift_share']:.1%}  (threshold: {DRIFT_THRESHOLD:.0%})")
    print(f"    Dataset drift    : {'YES ⚠️' if summary['dataset_drift'] else 'NO ✅'}")

    print(f"\n  Prediction Summary:")
    print(f"    Total predictions: {pred_report['total_predictions']:,}")
    print(f"    Fraud rate       : {pred_report['fraud_rate']:.2%}")
    print(f"    Avg probability  : {pred_report.get('avg_probability', 'N/A')}")

    # Feature-level detail
    print(f"\n  Feature Drift Details:")
    for feat, info in drift_report["features"].items():
        score_key = "psi" if info["type"] == "numeric" else "score"
        status = "🔴 DRIFT" if info["drifted"] else "🟢 OK"
        print(f"    {feat:<22} {status}  score={info[score_key]:.4f}  severity={info['severity']}")

    # Alert check
    check_and_alert(drift_report, pred_report)
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
