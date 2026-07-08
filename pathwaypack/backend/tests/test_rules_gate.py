"""The rules verification gate (HARD RULE 5) is enforced in code, not docs."""
import pytest

import app.config as config
import app.rules.loader as loader


def _set_env(monkeypatch, **env):
    """Change settings without reloading modules (reloading would swap module
    identities and break other modules' bound imports). load_rules() calls
    get_settings() fresh each time, so clearing its cache is sufficient."""
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    config.get_settings.cache_clear()
    loader.load_rules_cached.cache_clear()


def test_draft_rules_are_unverified():
    # The committed drafts must all be unverified (verified_against: null).
    for rs in loader.ALL_RULE_SETS:
        status = loader.rule_status(rs)
        assert status["present"], f"{rs} missing"
        assert status["verified"] is False, (
            f"{rs} is marked verified — did someone populate verified_against "
            f"without a real GMC check?"
        )


def test_production_blocks_unverified_rules(monkeypatch):
    _set_env(monkeypatch, ENVIRONMENT="production", ALLOW_UNVERIFIED_RULES="1")
    try:
        with pytest.raises(loader.UnverifiedRulesError):
            loader.load_rules("cv_structure")
    finally:
        _set_env(monkeypatch, ENVIRONMENT="development", ALLOW_UNVERIFIED_RULES="1")


def test_development_allows_unverified_rules(monkeypatch):
    _set_env(monkeypatch, ENVIRONMENT="development", ALLOW_UNVERIFIED_RULES="1")
    doc = loader.load_rules("cv_structure")
    assert doc["rule_set"] == "cv_structure"


def test_is_verified_requires_all_keys():
    assert not loader.is_verified({"verified_against": None})
    assert not loader.is_verified({"verified_against": {"source_url": "x"}})
    assert loader.is_verified({"verified_against": {
        "source_url": "https://gmc-uk.org/x",
        "verified_on": "2026-07-08",
        "verified_by": "Ali",
    }})
