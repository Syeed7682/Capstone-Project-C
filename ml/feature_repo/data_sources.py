"""
data_sources.py
───────────────
Feast DataSource definitions pointing to the local Parquet files.
"""

import os
from feast import FileSource
from feast.data_format import ParquetFormat

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PARQUET_PATH = os.path.join(ROOT, "data", "feast", "transactions.parquet")

transactions_source = FileSource(
    name="transactions_source",
    path=PARQUET_PATH,
    file_format=ParquetFormat(),
    timestamp_field="event_timestamp",
    description="Validated transaction data exported as Parquet for Feast offline store",
)
