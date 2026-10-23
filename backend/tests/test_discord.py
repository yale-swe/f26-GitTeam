import uuid
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import httpx
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
from app.models.activity import ActivityItem
from app.models.enums import IntegrationProvider
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


def _connect(client: TestClient, project_id: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "discord_bot_token", "test-token")
    _allow_channel(monkeypatch)
    res = client.post(
        f"/api/projects/{project_id}/integrations/discord",
        json={"guildId": "guild-1", "channelId": "channel-1"},
    )
    assert res.status_code == 200


def _install_discord(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    real_client = httpx.Client

    def factory(*args, **kwargs):
        return real_client(transport=httpx.MockTransport(handler))

    monkeypatch.setattr("app.integrations.discord.httpx.Client", factory)


def _message(
    message_id: str,
    *,
    content: str = "hello",
    bot: bool = False,
    channel_id: str = "channel-1",
    guild_id: str = "guild-1",
    attachments: list[dict] | None = None,
) -> dict:
    return {
        "id": message_id,
        "channel_id": channel_id,
        "guild_id": guild_id,
        "author": {"id": "user-1", "username": "ada", "global_name": "Ada", "bot": bot},
        "timestamp": "2026-10-09T16:00:00.000000+00:00",
        "content": content,
        "attachments": attachments or [],
    }


def _activity(db_session: Session, project_id: str) -> list[ActivityItem]:
    db_session.expire_all()
    return list(
        db_session.scalars(
            select(ActivityItem)
            .where(ActivityItem.project_id == uuid.UUID(project_id))
            .order_by(ActivityItem.source_id)
        )
    )


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


def test_sync_requires_a_connected_channel(client: TestClient):
    project_id = _create_project(client)

    res = client.post(f"/api/projects/{project_id}/integrations/discord/sync")

    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "not_connected"


def test_imports_messages_from_a_selected_channel(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Import and normalize relevant human messages from an approved project channel."""
    project_id = _create_project(client)
    _connect(client, project_id, monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/channels/channel-1/messages")
        assert request.headers["Authorization"] == "Bot test-token"
        return httpx.Response(200, json=[_message("42", content="shipped the signup form")])

    _install_discord(monkeypatch, handler)
    res = client.post(f"/api/projects/{project_id}/integrations/discord/sync")

    assert res.status_code == 200
    body = res.json()
    assert body == {
        "provider": "discord",
        "status": "healthy",
        "importedCount": 1,
    }
    rows = _activity(db_session, project_id)
    assert len(rows) == 1
    assert rows[0].source == IntegrationProvider.DISCORD
    assert rows[0].kind == "message"
    assert rows[0].source_id == "42"
    assert rows[0].title == "shipped the signup form"
    integration = db_session.scalars(
        select(Integration).where(Integration.project_id == uuid.UUID(project_id))
    ).one()
    assert integration.last_successful_sync_at is not None
    assert integration.last_sync_error is None


def test_import_preserves_discord_message_fields(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Preserve source ID, guild, channel, author, timestamp, content, and attachments."""
    project_id = _create_project(client)
    _connect(client, project_id, monkeypatch)
    attachment = {
        "id": "file-1",
        "filename": "slides.pdf",
        "url": "https://cdn.example/slides.pdf",
        "size": 12,
        "content_type": "application/pdf",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[_message("42", content="status update", attachments=[attachment])],
        )

    _install_discord(monkeypatch, handler)
    synced = client.post(f"/api/projects/{project_id}/integrations/discord/sync")
    assert synced.status_code == 200

    row = _activity(db_session, project_id)[0]
    assert row.source_id == "42"
    assert row.occurred_at == datetime(2026, 10, 9, 16, 0, tzinfo=UTC)
    assert row.url == "https://discord.com/channels/guild-1/channel-1/42"
    assert row.details == {
        "guild_id": "guild-1",
        "channel_id": "channel-1",
        "author_id": "user-1",
        "author_name": "Ada",
        "content": "status update",
        "attachments": [attachment],
    }


def test_ignores_unselected_channels_and_bot_messages(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Do not collect messages outside the project's configured Discord scope."""
    project_id = _create_project(client)
    _connect(client, project_id, monkeypatch)
    requested: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested.append(request.url.path)
        return httpx.Response(
            200,
            json=[
                _message("1", content="human update"),
                _message("2", content="bot noise", bot=True),
                _message("3", content="other channel", channel_id="channel-2"),
            ],
        )

    _install_discord(monkeypatch, handler)
    res = client.post(f"/api/projects/{project_id}/integrations/discord/sync")

    assert res.status_code == 200
    assert res.json()["importedCount"] == 1
    assert requested == ["/api/v10/channels/channel-1/messages"]
    assert [row.source_id for row in _activity(db_session, project_id)] == ["1"]


def test_imports_multiple_pages_without_exceeding_the_configured_limit(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Paginate through recent history while respecting the project's import limit."""
    monkeypatch.setattr(settings, "discord_import_limit", 150)
    project_id = _create_project(client)
    _connect(client, project_id, monkeypatch)
    calls: list[tuple[str | None, int]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        cursor = request.url.params.get("before")
        limit = int(request.url.params["limit"])
        calls.append((cursor, limit))
        if cursor is None:
            ids = [str(index) for index in range(200, 100, -1)]
        elif cursor == "101":
            ids = [str(index) for index in range(100, 0, -1)]
        else:
            ids = []
        return httpx.Response(200, json=[_message(message_id) for message_id in ids[:limit]])

    _install_discord(monkeypatch, handler)
    res = client.post(f"/api/projects/{project_id}/integrations/discord/sync")

    assert res.status_code == 200
    assert calls == [(None, 100), ("101", 50)]
    stored = sorted(
        (row.source_id for row in _activity(db_session, project_id)),
        key=int,
    )
    assert stored == [str(index) for index in range(51, 201)]
    assert res.json()["importedCount"] == 150


@pytest.mark.skip(reason="History sync cannot see message deletions; gateway events are separate")
def test_syncs_created_updated_and_deleted_messages():
    """Keep stored messages aligned with core Discord message events."""


def test_replayed_messages_do_not_create_duplicates(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    """Make history retries and repeated gateway events idempotent by message ID."""
    project_id = _create_project(client)
    _connect(client, project_id, monkeypatch)
    current = {"content": "hello"}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[_message("42", content=current["content"])])

    _install_discord(monkeypatch, handler)
    url = f"/api/projects/{project_id}/integrations/discord/sync"
    assert client.post(url).json()["importedCount"] == 1
    assert client.post(url).json()["importedCount"] == 1
    current["content"] = "edited"
    assert client.post(url).json()["importedCount"] == 1

    rows = _activity(db_session, project_id)
    assert len(rows) == 1
    assert rows[0].title == "edited"
    assert rows[0].details["content"] == "edited"


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
