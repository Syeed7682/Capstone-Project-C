"""
features.py
───────────
Feast Entity + FeatureView definitions for the fraud detection feature store.

Entities
--------
transaction : keyed by transaction_id

FeatureViews
------------
transaction_features : numeric + categorical transaction features (TTL 7 days)
"""

from datetime import timedelta
from feast import Entity, FeatureView, Field
from feast.types import Float64, Int64, String

from data_sources import transactions_source  # relative import within feature_repo

# ── Entity ────────────────────────────────────────────────────────────────────
transaction_entity = Entity(
    name="transaction",
    join_keys=["transaction_id"],
    description="A financial transaction",
)

# ── Feature View ──────────────────────────────────────────────────────────────
transaction_features = FeatureView(
    name="transaction_features",
    entities=[transaction_entity],
    ttl=timedelta(days=7),
    schema=[
        Field(name="amount",              dtype=Float64, description="Transaction amount in USD"),
        Field(name="merchant_category",   dtype=String,  description="Merchant category code"),
        Field(name="hour_of_day",         dtype=Int64,   description="Hour of transaction (0-23)"),
        Field(name="day_of_week",         dtype=Int64,   description="Day of week (0=Mon, 6=Sun)"),
        Field(name="distance_from_home",  dtype=Float64, description="Distance from home in km"),
        Field(name="prev_transactions",   dtype=Int64,   description="Transactions in last 24h"),
    ],
    source=transactions_source,
    description="Core transaction features for fraud detection",
    tags={"team": "fraud", "version": "1"},
)
