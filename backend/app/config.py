import os
from functools import lru_cache
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_JWT_SECRETS = {"", "dev-only-change-me", "change-me"}


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
    # The Co-Pilot chatbot is conversational guidance, not the clause-labeling
    # engine — a small fast instruct model answers in a fraction of the 70B's
    # time with no effect on analysis accuracy.
    copilot_model: str = "meta/llama-3.1-8b-instruct"
    reasoning_timeout_seconds: int = 30
    reasoning_max_retries: int = 3
    reasoning_max_rpm: int = 30
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    database_url: str = "sqlite+aiosqlite:///./clarifyd.db"
    db_echo: bool = False
    db_create_all_on_startup: bool = True
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    # ---------- Clerk ----------
    clerk_issuer: str = ""
    clerk_jwks_url: str = ""
    clerk_audience: str = ""
    clerk_secret_key: str = ""
    # Svix signing secret (whsec_...) for the Clerk -> /webhooks/clerk receiver.
    # Unset means the endpoint refuses every request; see clerk_webhooks.py.
    clerk_webhook_secret: str = ""
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
    # --- Gmail SMTP backup (used if Resend errors / is unconfigured) ---
    # Generate the app password at https://myaccount.google.com/apppasswords
    # — requires 2-step verification enabled. The app password is 16 chars.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""           # full Gmail address
    smtp_password: str = ""       # 16-char App Password (NOT your Gmail login pw)
    smtp_from: str = ""           # optional override (defaults to smtp_user)
    smtp_use_tls: bool = True
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

    @model_validator(mode="after")
    def _reject_insecure_prod_secret(self) -> "Settings":
        # A default/blank JWT secret in production would let anyone forge
        # tokens and OAuth-state HMACs. Fail fast at startup instead.
        if self.environment == "production" and self.jwt_secret in _INSECURE_JWT_SECRETS:
            raise ValueError(
                "jwt_secret must be set to a strong random value in production "
                "(JWT_SECRET env var)."
            )
        return self


_ASYNCPG_UNSUPPORTED_QS_KEYS = {
    "sslmode",
    "channel_binding",
    "options",
    "application_name",
    "connect_timeout",
}


def _neon_url_for_asyncpg() -> str | None:
    """Convert a Vercel/Neon-style Postgres URL into the asyncpg dialect.

    SQLAlchemy's async engine requires `postgresql+asyncpg://` and asyncpg
    rejects libpq-style query params like `sslmode=require` and
    `channel_binding=require`. Strip those, keep only asyncpg-friendly
    params, and rewrite the driver prefix.
    """
    candidates = [
        os.environ.get("DATABASE_URL"),
        os.environ.get("POSTGRES_URL_NON_POOLING"),
        os.environ.get("POSTGRES_URL"),
    ]
    for raw in candidates:
        if not raw:
            continue
        url = raw.strip()
        if not url:
            continue
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        elif url.startswith("postgresql+asyncpg://"):
            url = "postgresql://" + url[len("postgresql+asyncpg://"):]
        elif not url.startswith("postgresql://"):
            continue
        parsed = urlparse(url)
        params = [
            (k, v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=False)
            if k.lower() not in _ASYNCPG_UNSUPPORTED_QS_KEYS
        ]
        cleaned = parsed._replace(
            scheme="postgresql+asyncpg",
            query=urlencode(params),
        )
        return urlunparse(cleaned)
    return None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    s = Settings()
    # Prefer a Neon/Postgres URL when present, otherwise leave the SQLite
    # default in place for local dev / Vercel /tmp fallback.
    neon = _neon_url_for_asyncpg()
    if neon and (
        not s.database_url
        or s.database_url.startswith("sqlite")
        or s.database_url.startswith("postgres")
    ):
        s.database_url = neon
    return s

