import pytest
from pydantic import ValidationError

from app.config import Settings


def _settings(**values: str) -> Settings:
    return Settings(_env_file=None, **values)


@pytest.mark.parametrize(
    "raw",
    [
        "https://abc.supabase.co",
        "https://abc.supabase.co/",
        "https://abc.supabase.co/rest/v1/",
        "https://abc.supabase.co/auth/v1",
        "  https://abc.supabase.co  ",
    ],
)
def test_supabase_url_is_reduced_to_the_project_origin(raw: str) -> None:
    assert _settings(supabase_url=raw).supabase_url == "https://abc.supabase.co"


def test_supabase_url_keeps_a_local_port() -> None:
    assert _settings(supabase_url="http://localhost:54321/").supabase_url == (
        "http://localhost:54321"
    )


def test_supabase_url_may_be_unset() -> None:
    assert _settings(supabase_url="").supabase_url == ""


@pytest.mark.parametrize("raw", ["abc.supabase.co", "ftp://abc.supabase.co", "https://"])
def test_a_malformed_supabase_url_fails_at_startup(raw: str) -> None:
    with pytest.raises(ValidationError, match="SUPABASE_URL"):
        _settings(supabase_url=raw)


def test_risky_defaults_are_off() -> None:
    settings = _settings()
    assert settings.discord_debug_messages_enabled is False
    assert settings.summary_min_interval_seconds > 0
