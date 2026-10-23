import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.integrations.discord import (
    READ_MESSAGE_HISTORY,
    VIEW_CHANNEL,
    DiscordChannel,
    DiscordError,
)
from app.models.integration import Integration


def _create_project(client: TestClient) -> str:
    res = client.post(
        "/api/projects",
        json={
            "name": "Campus Cart",
            "summary": "Marketplace for students to trade used textbooks.",
            "features": ["Listings"],
            "milestones": [{"title": "Plan approved", "dueAt": "2026-12-01T00:00:00Z"}],
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def _allow_channel(monkeypatch: pytest.MonkeyPatch, name: str = "general") -> None:
    def fake_verify(
        *,
        guild_id: str,
        channel_id: str,
        token: str | None = None,
        client: object = None,
    ) -> DiscordChannel:
        assert token == "test-token"
        return DiscordChannel(id=channel_id, guild_id=guild_id, name=name)

    monkeypatch.setattr("app.integrations.discord_sync.verify_channel_access", fake_verify)


def test_connects_with_required_configuration_and_read_only_permissions(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Build a valid Discord connection using only the permissions DevSync needs."""
    monkeypatch.setattr(settings, "discord_bot_token", "test-token")
    monkeypatch.setattr(settings, "discord_client_id", "998877")
    _allow_channel(monkeypatch)

    project_id = _create_project(client)
    res = client.post(
        f"/api/projects/{project_id}/integrations/discord",
        json={"guildId": "guild-1", "channelId": "channel-1"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "discord"
    assert body["status"] == "connected"
    assert body["lastSuccessfulSyncAt"] is None

    invite = parse_qs(urlparse(client.get("/api/discord/invite").json()["url"]).query)
    assert invite["scope"] == ["bot"]
    assert int(invite["permissions"][0]) == VIEW_CHANNEL | READ_MESSAGE_HISTORY

    db_session.expire_all()
    rows = list(
        db_session.scalars(
            select(Integration).where(Integration.project_id == uuid.UUID(project_id))
        )
    )
    assert len(rows) == 1
    assert rows[0].config == {
        "guild_id": "guild-1",
        "channel_id": "channel-1",
        "channel_name": "general",
    }
    assert "token" not in rows[0].config


def test_reconnecting_updates_the_same_bot_channel(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """A second connect points the project at another channel. It does not add a second bot."""
    monkeypatch.setattr(settings, "discord_bot_token", "test-token")
    _allow_channel(monkeypatch, name="planning")
    project_id = _create_project(client)
    url = f"/api/projects/{project_id}/integrations/discord"
    first = client.post(url, json={"guildId": "guild-1", "channelId": "channel-1"})
    assert first.status_code == 200

    res = client.post(url, json={"guildId": "guild-1", "channelId": "channel-2"})

    assert res.status_code == 200
    db_session.expire_all()
    rows = list(
        db_session.scalars(
            select(Integration).where(Integration.project_id == uuid.UUID(project_id))
        )
    )
    assert len(rows) == 1
    assert rows[0].config["channel_id"] == "channel-2"
    assert rows[0].config["channel_name"] == "planning"


def test_connect_returns_the_invite_when_the_bot_cannot_see_the_channel(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "discord_bot_token", "test-token")
    monkeypatch.setattr(settings, "discord_client_id", "998877")

    def missing_access(**kwargs: object) -> DiscordChannel:
        raise DiscordError(403, "Missing Access")

    monkeypatch.setattr("app.integrations.discord_sync.verify_channel_access", missing_access)
    project_id = _create_project(client)

    res = client.post(
        f"/api/projects/{project_id}/integrations/discord",
        json={"guildId": "guild-1", "channelId": "channel-1"},
    )

    assert res.status_code == 502
    detail = res.json()["detail"]
    assert detail["message"] == "Missing Access"
    assert "client_id=998877" in detail["inviteUrl"]
    assert "scope=bot" in detail["inviteUrl"]


def test_connect_requires_the_shared_bot_token(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "discord_bot_token", "")
    project_id = _create_project(client)

    res = client.post(
        f"/api/projects/{project_id}/integrations/discord",
        json={"guildId": "guild-1", "channelId": "channel-1"},
    )

    assert res.status_code == 500
    assert res.json()["detail"]["code"] == "config_error"
    db_session.expire_all()
    rows = list(db_session.scalars(select(Integration)))
    assert rows == []


def test_missing_project_cannot_connect_discord(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(settings, "discord_bot_token", "test-token")
    _allow_channel(monkeypatch)

    res = client.post(
        f"/api/projects/{uuid.uuid4()}/integrations/discord",
        json={"guildId": "guild-1", "channelId": "channel-1"},
    )

    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "not_found"


@pytest.mark.skip(reason="Discord channel sync is not implemented yet")
def test_imports_messages_from_a_selected_channel():
    """Import and normalize relevant human messages from an approved project channel."""


@pytest.mark.skip(reason="Discord channel sync is not implemented yet")
def test_import_preserves_discord_message_fields():
    """Preserve source ID, guild, channel, author, timestamp, content, and attachments."""


@pytest.mark.skip(reason="Discord channel sync is not implemented yet")
def test_ignores_unselected_channels_and_bot_messages():
    """Do not collect messages outside the project's configured Discord scope."""


@pytest.mark.skip(reason="Discord channel sync is not implemented yet")
def test_imports_multiple_pages_without_exceeding_the_configured_limit():
    """Paginate through recent history while respecting the project's import limit."""


@pytest.mark.skip(reason="History sync cannot see message deletions; gateway events are separate")
def test_syncs_created_updated_and_deleted_messages():
    """Keep stored messages aligned with core Discord message events."""


@pytest.mark.skip(reason="Discord channel sync is not implemented yet")
def test_replayed_messages_do_not_create_duplicates():
    """Make history retries and repeated gateway events idempotent by message ID."""


@pytest.mark.skip(reason="Blocker and decision extraction belongs to project health")
def test_extracts_project_health_signals_with_source_messages():
    """Turn progress, blockers, decisions, and action items into evidence-backed signals."""


@pytest.mark.skip(reason="Blocker and decision extraction belongs to project health")
def test_irrelevant_conversation_does_not_change_project_health():
    """Ignore casual or unrelated discussion when calculating project status."""


@pytest.mark.skip(reason="Blocker and decision extraction belongs to project health")
def test_message_edits_and_deletions_refresh_derived_health_signals():
    """Update or remove analysis results when their Discord evidence changes."""


@pytest.mark.skip(reason="Summary failure handling belongs to the summary flow")
def test_analysis_failure_does_not_replace_the_last_valid_health_summary():
    """Preserve valid project health data when analysis fails or returns invalid output."""
