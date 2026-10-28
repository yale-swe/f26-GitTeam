import httpx
import pytest

from app.config import settings
from app.integrations.discord import DiscordError, list_readable_channels


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_lists_text_channels_in_server_order():
    """The picker shows text and announcement channels, not voice or categories."""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bot test-token"
        if request.url.path == "/api/v10/users/@me/guilds":
            return httpx.Response(200, json=[{"id": "guild-1", "name": "Campus Cart"}])
        if request.url.path == "/api/v10/guilds/guild-1/channels":
            return httpx.Response(
                200,
                json=[
                    {"id": "voice", "name": "voice", "type": 2, "position": 0},
                    {"id": "dev", "name": "campus-cart-dev", "type": 0, "position": 2},
                    {"id": "news", "name": "announcements", "type": 5, "position": 1},
                    {"id": "category", "name": "category", "type": 4, "position": 3},
                ],
            )
        raise AssertionError(request.url.path)

    guilds = list_readable_channels(token="test-token", client=_client(handler))

    assert len(guilds) == 1
    assert guilds[0].id == "guild-1"
    assert guilds[0].name == "Campus Cart"
    assert [(channel.id, channel.name) for channel in guilds[0].channels] == [
        ("news", "announcements"),
        ("dev", "campus-cart-dev"),
    ]


def test_skips_a_server_the_bot_cannot_list():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v10/users/@me/guilds":
            return httpx.Response(
                200,
                json=[
                    {"id": "open", "name": "Open"},
                    {"id": "locked", "name": "Locked"},
                ],
            )
        if request.url.path == "/api/v10/guilds/locked/channels":
            return httpx.Response(403, json={"message": "Missing Access"})
        if request.url.path == "/api/v10/guilds/open/channels":
            return httpx.Response(
                200,
                json=[{"id": "general", "name": "general", "type": 0, "position": 0}],
            )
        raise AssertionError(request.url.path)

    guilds = list_readable_channels(token="test-token", client=_client(handler))

    assert [guild.id for guild in guilds] == ["open"]
    assert guilds[0].channels[0].id == "general"


def test_pages_servers_when_discord_returns_a_full_page():
    seen_after: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v10/users/@me/guilds":
            after = request.url.params.get("after")
            seen_after.append(after)
            if after is None:
                page = [{"id": str(index), "name": "server"} for index in range(200)]
                return httpx.Response(200, json=page)
            return httpx.Response(200, json=[{"id": "200", "name": "last"}])
        return httpx.Response(200, json=[])

    guilds = list_readable_channels(token="test-token", client=_client(handler))

    assert seen_after == [None, "199"]
    assert [guild.id for guild in guilds][-1] == "200"
    assert len(guilds) == 201


def test_missing_token_is_an_error(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "discord_bot_token", "")

    with pytest.raises(Exception, match="DISCORD_BOT_TOKEN"):
        list_readable_channels()


def test_discord_errors_include_the_status():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "401: Unauthorized"})

    with pytest.raises(DiscordError) as caught:
        list_readable_channels(token="bad-token", client=_client(handler))

    assert caught.value.status_code == 401

