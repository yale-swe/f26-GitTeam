from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.integrations.discord import (
    DiscordConfigError,
    DiscordError,
    fetch_channel_messages,
)
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _authenticated() -> Iterator[None]:
    app.dependency_overrides[get_current_user] = lambda: {"sub": "test-user"}
    yield
    app.dependency_overrides.pop(get_current_user, None)


def _message(
    message_id: str,
    *,
    content: str = "hello",
    bot: bool = False,
    attachments: list[dict] | None = None,
) -> dict:
    return {
        "id": message_id,
        "channel_id": "channel-1",
        "guild_id": "guild-1",
        "author": {
            "id": "user-1",
            "username": "ada",
            "global_name": "Ada",
            "bot": bot,
        },
        "timestamp": "2026-10-09T16:00:00.000000+00:00",
        "content": content,
        "attachments": attachments or [],
    }


def _client(pages: dict[str | None, list[dict]]) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        cursor = request.url.params.get("before") or request.url.params.get("after")
        if "around" in request.url.params:
            cursor = f"around:{request.url.params['around']}"
        page = pages.get(cursor, [])
        limit = int(request.url.params["limit"])
        return httpx.Response(200, json=page[:limit])

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_reads_the_last_100_messages_by_default():
    page = [_message(str(index)) for index in range(100, 0, -1)]
    seen_limits: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_limits.append(int(request.url.params["limit"]))
        assert request.headers["Authorization"] == "Bot test-token"
        assert request.url.path.endswith("/channels/channel-1/messages")
        return httpx.Response(200, json=page)

    messages = fetch_channel_messages(
        channel_id="channel-1",
        token="test-token",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert seen_limits == [100]
    assert len(messages) == 100
    assert messages[0].id == "1"
    assert messages[-1].id == "100"


def test_preserves_message_fields():
    raw = _message(
        "42",
        content="status update",
        attachments=[
            {
                "id": "file-1",
                "filename": "slides.pdf",
                "url": "https://cdn.example/slides.pdf",
                "size": 12,
                "content_type": "application/pdf",
            }
        ],
    )
    messages = fetch_channel_messages(
        channel_id="channel-1",
        limit=1,
        token="test-token",
        client=_client({None: [raw]}),
    )

    message = messages[0]
    assert message.id == "42"
    assert message.channel_id == "channel-1"
    assert message.guild_id == "guild-1"
    assert message.author_id == "user-1"
    assert message.author_name == "Ada"
    assert message.author_bot is False
    assert message.timestamp.startswith("2026-10-09")
    assert message.content == "status update"
    assert message.attachments[0].filename == "slides.pdf"
    assert message.attachments[0].size == 12


def test_paginates_with_before_until_the_limit():
    first = [_message(str(index)) for index in range(200, 100, -1)]
    second = [_message(str(index)) for index in range(100, 80, -1)]
    requests: list[tuple[str | None, int]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        before = request.url.params.get("before")
        limit = int(request.url.params["limit"])
        requests.append((before, limit))
        page = first if before is None else second
        return httpx.Response(200, json=page[:limit])

    messages = fetch_channel_messages(
        channel_id="channel-1",
        limit=120,
        token="test-token",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert requests == [(None, 100), ("101", 20)]
    assert len(messages) == 120
    assert messages[0].id == "81"
    assert messages[-1].id == "200"


def test_after_pagination_stays_chronological():
    first = [_message(str(index)) for index in range(100, 0, -1)]
    second = [_message(str(index)) for index in range(120, 100, -1)]

    def handler(request: httpx.Request) -> httpx.Response:
        after = request.url.params.get("after")
        limit = int(request.url.params["limit"])
        page = first if after == "0" else second
        return httpx.Response(200, json=page[:limit])

    messages = fetch_channel_messages(
        channel_id="channel-1",
        limit=120,
        after="0",
        token="test-token",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert [message.id for message in messages] == [str(index) for index in range(1, 121)]


def test_passes_before_after_and_around_as_cursors():
    seen: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(dict(request.url.params))
        return httpx.Response(200, json=[_message("9")])

    http = httpx.Client(transport=httpx.MockTransport(handler))
    fetch_channel_messages(
        channel_id="channel-1", limit=1, before="50", token="test-token", client=http
    )
    fetch_channel_messages(
        channel_id="channel-1", limit=1, after="10", token="test-token", client=http
    )
    fetch_channel_messages(
        channel_id="channel-1", limit=1, around="30", token="test-token", client=http
    )

    assert seen[0]["before"] == "50"
    assert "after" not in seen[0]
    assert seen[1]["after"] == "10"
    assert seen[2]["around"] == "30"


def test_rejects_more_than_one_cursor():
    with pytest.raises(ValueError, match="mutually exclusive"):
        fetch_channel_messages(
            channel_id="channel-1",
            token="test-token",
            before="1",
            after="2",
            client=_client({}),
        )


def test_can_omit_bot_messages():
    page = [_message("2", bot=True, content="bot"), _message("1", content="human")]
    messages = fetch_channel_messages(
        channel_id="channel-1",
        limit=2,
        include_bots=False,
        token="test-token",
        client=_client({None: page}),
    )

    assert len(messages) == 1
    assert messages[0].author_bot is False
    assert messages[0].content == "human"


def test_missing_token_is_an_error(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("app.integrations.discord.settings.discord_bot_token", "")
    monkeypatch.setattr("app.integrations.discord.settings.discord_channel_id", "channel-1")

    with pytest.raises(DiscordConfigError, match="DISCORD_BOT_TOKEN"):
        fetch_channel_messages()


def test_discord_errors_include_the_status():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"message": "Missing Access", "code": 50001})

    with pytest.raises(DiscordError) as caught:
        fetch_channel_messages(
            channel_id="channel-1",
            token="test-token",
            client=httpx.Client(transport=httpx.MockTransport(handler)),
        )

    assert caught.value.status_code == 403
    assert caught.value.message == "Missing Access"


def test_messages_route_returns_the_reader_result(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        "app.api.routes.discord.fetch_channel_messages",
        lambda **_kwargs: [
            {
                "id": "7",
                "channel_id": "channel-1",
                "guild_id": "guild-1",
                "author_id": "user-1",
                "author_name": "Ada",
                "author_bot": False,
                "timestamp": "2026-10-09T16:00:00.000000+00:00",
                "content": "slides are ready",
                "attachments": [],
            }
        ],
    )

    response = client.get("/api/discord/messages?limit=100&include_bots=false")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["content"] == "slides are ready"
    assert body[0]["author_name"] == "Ada"


def test_messages_route_rejects_two_cursors():
    response = client.get("/api/discord/messages?before=1&after=2")

    assert response.status_code == 400
    assert "mutually exclusive" in response.json()["detail"]
