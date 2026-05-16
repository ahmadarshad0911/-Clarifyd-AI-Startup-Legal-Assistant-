from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "AI Contract Risk Analyzer"
    environment: str = "development"
    debug: bool = True
    log_level: str = "INFO"
    max_upload_file_size: int = 25 * 1024 * 1024
    allowed_file_types: str = ".pdf,.docx"
    reasoning_provider: str = "kimi"
    reasoning_base_url: str = "https://api.moonshot.ai/v1"
    reasoning_api_key: str | None = None
    reasoning_model: str = "moonshot-v1-32k"
    reasoning_model_fallback: str = "moonshot-v1-8k"
    reasoning_timeout_seconds: int = 30
    reasoning_max_retries: int = 3
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    database_url: str = "sqlite+aiosqlite:///./clarifyd.db"
    db_echo: bool = False
    db_create_all_on_startup: bool = True
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 60
    rate_limit_login_per_min: int = 10
    rate_limit_analyze_per_min: int = 10
    # Public POSTs (contact / feedback) — anti-spam.
    rate_limit_public_post_per_min: int = 15

    # --- Email / OTP verification ---
    # `console` logs the OTP to the backend log (dev).
    # `resend` sends via Resend API (needs resend_api_key).
    email_provider: str = "console"
    resend_api_key: str = ""
    email_from: str = "Clarifyd <onboarding@clarifyd.com>"
    otp_ttl_seconds: int = 600       # 10-minute code lifetime
    otp_max_attempts: int = 5        # per-verification brute-force cap
    otp_resend_cooldown_seconds: int = 60
    review_confidence_threshold: float = 0.7
    review_auto_route_severities: str = "high,critical"
    export_dir: str = "./exports"
    retention_days: int = 365

    # OAuth — Google + Facebook. Leave blank to disable a provider.
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    facebook_oauth_client_id: str = ""
    facebook_oauth_client_secret: str = ""
    # Microsoft kept for backward-compat with existing env files; not wired into UI.
    microsoft_oauth_client_id: str = ""
    microsoft_oauth_client_secret: str = ""
    microsoft_oauth_tenant: str = "common"
    # Public base URL of THIS backend (for redirect_uri sent to providers).
    oauth_backend_base_url: str = "http://localhost:8000"
    # Frontend URL the provider eventually returns the user to (with token).
    oauth_frontend_callback_url: str = "http://localhost:3000/oauth/callback"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("reasoning_provider")
    @classmethod
    def validate_reasoning_provider(cls, value: str) -> str:
        provider = value.strip().lower()
        if provider != "kimi":
            raise ValueError("reasoning_provider must be 'kimi'")
        return provider


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

