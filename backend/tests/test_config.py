import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_path))

from app import config


def test_normalize_secret_value_strips_whitespace_and_quotes():
    assert config.normalize_secret_value("  hf_token_value  ") == "hf_token_value"
    assert config.normalize_secret_value('"hf_token_value"') == "hf_token_value"
    assert config.normalize_secret_value("'gemini_key_value'") == "gemini_key_value"
