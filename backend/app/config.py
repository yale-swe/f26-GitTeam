from urllib.parse import urlsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://devsync:devsync@localhost:5432/devsync"
    cors_origins: list[str] = ["http://localhost:3000"]
    # Supabase Auth. Access tokens are verified against the project's JWKS
    # (<supabase_url>/auth/v1/.well-known/jwks.json); set supabase_jwt_secret
    # instead only if the project still uses the legacy HS256 shared secret.
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    # Cooldown between summary generations for one project. Each generation
    # spends OpenRouter credits, so repeat requests inside the window get a 429.
    summary_min_interval_seconds: int = 60
    discord_bot_token: str = ""
    discord_client_id: str = ""
    discord_channel_id: str = ""
    discord_import_limit: int = 100
    # GET /api/discord/messages reads any channel the shared bot can see, using
    # the bot's token. Keep it off outside local debugging.
    discord_debug_messages_enabled: bool = False
    github_app_client_id: str = ""
    github_app_client_secret: str = ""
    github_app_private_key: str = ""  # PEM; literal "\n" escapes are accepted
    github_app_slug: str = ""
    github_api_url: str = "https://api.github.com"
    github_backfill_days: int = 90
    github_sync_overlap_hours: int = 72
    github_max_pages: int = 10
    openrouter_api_key: str = ""
    openrouter_model: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_timeout_seconds: float = 30.0
    openrouter_max_completion_tokens: int = 2000

    @field_validator("supabase_url")
    @classmethod
    def _supabase_url_is_the_project_origin(cls, value: str) -> str:
        """Reduce SUPABASE_URL to `scheme://host`.

        The dashboard shows several URLs for a project (for example
        `.../rest/v1/` on the Data API page). Only the origin is correct here,
        because token issuer and key URLs are built from it.
        """
        value = value.strip()
        if not value:
            return ""
        parts = urlsplit(value)
        if parts.scheme not in {"http", "https"} or not parts.netloc:
            raise ValueError("SUPABASE_URL must look like https://<project-ref>.supabase.co")
        return f"{parts.scheme}://{parts.netloc}"


settings = Settings()
