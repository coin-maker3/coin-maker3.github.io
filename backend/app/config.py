from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    alpaca_api_key: str = ""
    alpaca_api_secret: str = ""
    sec_edgar_user_agent: str = "StockTriage contact@example.com"
    vision_model: str = "claude-haiku-4-5-20251001"
    vision_fallback_model: str = "claude-sonnet-4-6"
    log_level: str = "INFO"


settings = Settings()
