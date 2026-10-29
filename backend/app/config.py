from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://devsync:devsync@localhost:5432/devsync"
    cors_origins: list[str] = ["http://localhost:3000"]
    discord_bot_token: str = ""
    discord_channel_id: str = ""
    github_app_client_id: str = ""
    github_app_client_secret: str = ""
    github_app_private_key: str = ""  # PEM; literal "\n" escapes are accepted
    github_app_slug: str = ""
    github_api_url: str = "https://api.github.com"
    github_backfill_days: int = 90
    github_sync_overlap_hours: int = 72
    github_max_pages: int = 10


settings = Settings()
