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
    discord_bot_token: str = ""
    discord_client_id: str = ""
    discord_channel_id: str = ""
    discord_import_limit: int = 100
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


settings = Settings()
