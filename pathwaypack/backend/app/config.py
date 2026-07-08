"""Runtime configuration. All secrets come from the environment — never
committed. See .env.example."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


def _bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    """Reads the environment at construction time (not import time), so tests
    can change env + clear the get_settings() cache to pick up new values."""

    def __init__(self) -> None:
        # Deployment environment: "development" | "production"
        self.environment: str = os.environ.get("ENVIRONMENT", "development")

        # HARD RULE 5: unverified GMC rules are blocked in production. This
        # escape hatch is dev-only and is ignored when ENVIRONMENT=production.
        self.allow_unverified_rules: bool = _bool("ALLOW_UNVERIFIED_RULES", False)

        # HARD RULE 4: the Gmail adapter (Phase 5) only exists behind this flag
        # and is never enabled in a deployed public instance.
        self.personal_mode: bool = _bool("PERSONAL_MODE", False)

        # Extraction
        self.anthropic_api_key: str | None = os.environ.get("ANTHROPIC_API_KEY")
        self.gemini_api_key: str | None = os.environ.get("GEMINI_API_KEY")
        self.extraction_confidence_threshold: float = float(
            os.environ.get("EXTRACTION_CONFIDENCE_THRESHOLD", "0.7")
        )

        # Storage
        self.mongodb_uri: str | None = os.environ.get("MONGODB_URI")
        self.mongodb_db: str = os.environ.get("MONGODB_DB", "pathwaypack")

        # config.py -> app -> backend -> pathwaypack; rules at pathwaypack/rules
        self.rules_dir: Path = Path(
            os.environ.get("RULES_DIR",
                           str(Path(__file__).resolve().parents[2] / "rules"))
        )

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @property
    def unverified_rules_permitted(self) -> bool:
        """Unverified rules may only be served outside production."""
        return self.allow_unverified_rules and not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
