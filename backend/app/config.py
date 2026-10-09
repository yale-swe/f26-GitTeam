from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://devsync:devsync@localhost:5432/devsync"
    cors_origins: list[str] = ["http://localhost:3000"]
    discord_bot_token: str = ""
    discord_channel_id: str = ""


settings = Settings()
