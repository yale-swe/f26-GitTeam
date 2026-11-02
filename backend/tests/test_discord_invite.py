from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.integrations.discord import (
    BOT_PERMISSIONS,
    READ_MESSAGE_HISTORY,
    VIEW_CHANNEL,
    DiscordError,
    bot_invite_url,
    verify_channel_access,
)


def test_invite_url_requests_read_only_bot_access(monkeypatch: pytest.MonkeyPatch):
    """The shared bot is invited once, with permission to read history and nothing else."""
    monkeypatch.setattr(settings, "discord_client_id", "998877")

    parsed = urlparse(bot_invite_url())
    query = parse_qs(parsed.query)

    assert parsed.netloc == "discord.com"
    assert parsed.path == "/oauth2/authorize"
    assert query["client_id"] == ["998877"]
    assert query["scope"] == ["bot"]
    assert query["permissions"] == [str(BOT_PERMISSIONS)]
    assert BOT_PERMISSIONS == VIEW_CHANNEL | READ_MESSAGE_HISTORY
    assert BOT_PERMISSIONS & (1 << 3) == 0  # administrator
    assert BOT_PERMISSIONS & (1 << 11) == 0  # send messages
    assert BOT_PERMISSIONS & (1 << 13) == 0  # manage messages


def test_invite_route_returns_that_url(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "discord_client_id", "998877")

    res = client.get("/api/discord/invite")

    assert res.status_code == 200
    assert res.json()["url"] == bot_invite_url("998877")


def test_invite_route_requires_the_client_id(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "discord_client_id", "")

    res = client.get("/api/discord/invite")

    assert res.status_code == 500
    assert res.json()["detail"]["code"] == "config_error"


def test_verify_channel_checks_the_selected_server():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/api/v10/channels/channel-1"
        assert request.headers["Authorization"] == "Bot test-token"
        return httpx.Response(
            200,
            json={"id": "channel-1", "guild_id": "guild-1", "name": "general"},
        )

    channel = verify_channel_access(
        guild_id="guild-1",
        channel_id="channel-1",
        token="test-token",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert channel.id == "channel-1"
    assert channel.guild_id == "guild-1"
    assert channel.name == "general"


def test_verify_channel_rejects_a_different_server():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"id": "channel-1", "guild_id": "guild-9", "name": "general"},
        )

    with pytest.raises(DiscordError) as caught:
        verify_channel_access(
            guild_id="guild-1",
            channel_id="channel-1",
            token="test-token",
            client=httpx.Client(transport=httpx.MockTransport(handler)),
        )

    assert caught.value.status_code == 400


def test_missing_channel_access_keeps_the_discord_status():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"message": "Missing Access", "code": 50001})

    with pytest.raises(DiscordError) as caught:
        verify_channel_access(
            guild_id="guild-1",
            channel_id="channel-1",
            token="test-token",
            client=httpx.Client(transport=httpx.MockTransport(handler)),
        )

    assert caught.value.status_code == 403
    assert caught.value.message == "Missing Access"
