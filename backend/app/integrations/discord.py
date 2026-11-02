from urllib.parse import urlencode

import httpx
from pydantic import BaseModel, Field

from app.config import settings

DISCORD_API = "https://discord.com/api/v10"
PAGE_SIZE = 100
MAX_LIMIT = 1000
# View Channel + Read Message History. The shared bot is invited with these
# bits only, so it can read a selected channel and cannot post or manage it.
VIEW_CHANNEL = 1 << 10
READ_MESSAGE_HISTORY = 1 << 16
BOT_PERMISSIONS = VIEW_CHANNEL | READ_MESSAGE_HISTORY


class DiscordConfigError(Exception):
    """Raised when the bot token, client id, or channel id is missing."""


class DiscordError(Exception):
    """Raised when Discord rejects a request or cannot be reached."""

    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class DiscordAttachment(BaseModel):
    id: str
    filename: str
    url: str
    size: int
    content_type: str | None = None


class DiscordChannel(BaseModel):
    id: str
    guild_id: str
    name: str = ""


class DiscordMessage(BaseModel):
    id: str
    channel_id: str
    guild_id: str | None = None
    author_id: str
    author_name: str
    author_bot: bool = False
    timestamp: str
    content: str = ""
    attachments: list[DiscordAttachment] = Field(default_factory=list)


def bot_invite_url(client_id: str | None = None) -> str:
    """Return the URL that adds this same DevSync bot to a server.

    One application has one bot token. A server admin opens the URL and Discord
    adds that bot to their guild. Projects then share the token and name the
    channel the bot is allowed to read.
    """
    client_id = client_id if client_id is not None else settings.discord_client_id
    if not client_id:
        raise DiscordConfigError("DISCORD_CLIENT_ID is not set")
    query = urlencode(
        {
            "client_id": client_id,
            "scope": "bot",
            "permissions": str(BOT_PERMISSIONS),
        }
    )
    return f"https://discord.com/oauth2/authorize?{query}"


def verify_channel_access(
    *,
    guild_id: str,
    channel_id: str,
    token: str | None = None,
    client: httpx.Client | None = None,
) -> DiscordChannel:
    """Confirm the shared bot can see this channel in the given server."""
    if not guild_id or not channel_id:
        raise ValueError("guild_id and channel_id are required")

    token = token if token is not None else settings.discord_bot_token
    if not token:
        raise DiscordConfigError("DISCORD_BOT_TOKEN is not set")

    owns_client = client is None
    client = client or httpx.Client(timeout=30.0)
    try:
        try:
            response = client.get(
                f"{DISCORD_API}/channels/{channel_id}",
                headers={"Authorization": f"Bot {token}"},
            )
        except httpx.HTTPError as exc:
            raise DiscordError(502, "Discord is unreachable") from exc
        if response.status_code != 200:
            raise DiscordError(response.status_code, _error_message(response))
        try:
            body = response.json()
        except ValueError as exc:
            raise DiscordError(502, "Discord returned an unexpected response") from exc
    finally:
        if owns_client:
            client.close()

    if not isinstance(body, dict):
        raise DiscordError(502, "Discord returned an unexpected response")
    returned_guild = body.get("guild_id")
    if returned_guild is None:
        raise DiscordError(400, "That channel is not in a server")
    if str(returned_guild) != str(guild_id):
        raise DiscordError(400, "That channel is not in the selected server")
    return DiscordChannel(
        id=str(body.get("id") or channel_id),
        guild_id=str(returned_guild),
        name=str(body.get("name") or ""),
    )


def fetch_channel_messages(
    *,
    channel_id: str | None = None,
    limit: int = 100,
    before: str | None = None,
    after: str | None = None,
    around: str | None = None,
    include_bots: bool = True,
    token: str | None = None,
    client: httpx.Client | None = None,
) -> list[DiscordMessage]:
    """Read recent messages from a Discord channel, oldest first.

    ``limit`` is the number of messages to return. Discord sends at most 100
    per request, so larger limits are collected with ``before`` or ``after``.
    ``before``, ``after``, and ``around`` are Discord message ids and only one
    of them may be set. ``around`` returns a single page.
    """
    if limit < 1 or limit > MAX_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_LIMIT}")
    cursors = [cursor for cursor in (before, after, around) if cursor]
    if len(cursors) > 1:
        raise ValueError("before, after, and around are mutually exclusive")
    if around and limit > PAGE_SIZE:
        raise ValueError(f"around returns at most {PAGE_SIZE} messages")

    token = token if token is not None else settings.discord_bot_token
    channel_id = channel_id or settings.discord_channel_id
    if not token:
        raise DiscordConfigError("DISCORD_BOT_TOKEN is not set")
    if not channel_id:
        raise DiscordConfigError("DISCORD_CHANNEL_ID is not set")

    owns_client = client is None
    client = client or httpx.Client(timeout=30.0)
    try:
        raw_messages = _paginate(
            client,
            token=token,
            channel_id=channel_id,
            limit=limit,
            before=before,
            after=after,
            around=around,
        )
    finally:
        if owns_client:
            client.close()

    messages = [_normalize(message, channel_id) for message in raw_messages]
    if not include_bots:
        messages = [message for message in messages if not message.author_bot]
    return messages


def _paginate(
    client: httpx.Client,
    *,
    token: str,
    channel_id: str,
    limit: int,
    before: str | None,
    after: str | None,
    around: str | None,
) -> list[dict]:
    collected: list[dict] = []
    page_before = before
    page_after = after
    while len(collected) < limit:
        page_limit = min(PAGE_SIZE, limit - len(collected))
        params: dict[str, str | int] = {"limit": page_limit}
        if page_before:
            params["before"] = page_before
        elif page_after:
            params["after"] = page_after
        elif around:
            params["around"] = around
        page = _get_page(client, token, channel_id, params)
        if not page:
            break
        # Each page is newest first. `after` walks forward, so reverse that page
        # before appending. `before` walks backward, so keep the page and reverse
        # the whole collection at the end.
        if after:
            collected.extend(reversed(page))
        else:
            collected.extend(page)
        if around or len(page) < page_limit:
            break
        if page_after:
            page_after = str(page[0]["id"])
        else:
            page_before = str(page[-1]["id"])
    if after:
        return collected[:limit]
    return list(reversed(collected[:limit]))


def _get_page(
    client: httpx.Client,
    token: str,
    channel_id: str,
    params: dict[str, str | int],
) -> list[dict]:
    try:
        response = client.get(
            f"{DISCORD_API}/channels/{channel_id}/messages",
            params=params,
            headers={"Authorization": f"Bot {token}"},
        )
    except httpx.HTTPError as exc:
        raise DiscordError(502, "Discord is unreachable") from exc
    if response.status_code != 200:
        raise DiscordError(response.status_code, _error_message(response))
    body = response.json()
    if not isinstance(body, list):
        raise DiscordError(502, "Discord returned an unexpected response")
    return body


def _error_message(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.text[:200] or "Discord request failed"
    if isinstance(body, dict) and body.get("message"):
        return str(body["message"])
    return "Discord request failed"


def _normalize(message: dict, channel_id: str) -> DiscordMessage:
    author = message.get("author") or {}
    attachments = [
        DiscordAttachment(
            id=str(item.get("id", "")),
            filename=str(item.get("filename", "")),
            url=str(item.get("url", "")),
            size=int(item.get("size") or 0),
            content_type=item.get("content_type"),
        )
        for item in message.get("attachments") or []
    ]
    return DiscordMessage(
        id=str(message["id"]),
        channel_id=str(message.get("channel_id") or channel_id),
        guild_id=str(message["guild_id"]) if message.get("guild_id") else None,
        author_id=str(author.get("id", "")),
        author_name=str(author.get("global_name") or author.get("username") or "unknown"),
        author_bot=bool(author.get("bot")),
        timestamp=str(message.get("timestamp", "")),
        content=str(message.get("content") or ""),
        attachments=attachments,
    )
