import uuid

from fastapi import APIRouter, HTTPException, Query

from app.db import DbSession
from app.integrations.discord import (
    MAX_LIMIT,
    DiscordConfigError,
    DiscordError,
    DiscordMessage,
    bot_invite_url,
    fetch_channel_messages,
)
from app.integrations.discord_sync import (
    DiscordNotConnected,
    ProjectNotFound,
    connect_discord,
    sync_discord,
)
from app.schemas.integration import (
    DiscordConnect,
    DiscordInvite,
    IntegrationStatusRead,
    SyncResultRead,
)

router = APIRouter(prefix="/discord", tags=["discord"])
project_router = APIRouter(tags=["discord"])


def _discord_http_error(exc: DiscordError) -> HTTPException:
    """Map a Discord failure onto the API error shape.

    A 403 or 404 usually means this bot is not in the server, or it cannot see
    that channel. The invite URL adds the same bot with read-only access.
    """
    if exc.status_code == 400:
        return HTTPException(
            status_code=400,
            detail={"code": "bad_request", "message": exc.message},
        )
    detail: dict[str, str] = {"code": "external_error", "message": exc.message}
    if exc.status_code in {403, 404}:
        try:
            detail["inviteUrl"] = bot_invite_url()
        except DiscordConfigError:
            pass
    return HTTPException(status_code=502, detail=detail)


@router.get("/invite", response_model=DiscordInvite)
def get_invite() -> DiscordInvite:
    """Return the URL that invites the shared DevSync bot into a server.

    The bot token stays on the server. After an admin accepts the invite, a
    project connects by guild id and channel id.
    """
    try:
        return DiscordInvite(url=bot_invite_url())
    except DiscordConfigError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "config_error", "message": str(exc)},
        ) from exc


@router.get("/messages", response_model=list[DiscordMessage])
def list_messages(
    channel_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=MAX_LIMIT),
    before: str | None = None,
    after: str | None = None,
    around: str | None = None,
    include_bots: bool = True,
) -> list[DiscordMessage]:
    """Return recent messages from a Discord channel, oldest first.

    Defaults to the last 100 messages in ``DISCORD_CHANNEL_ID``. ``limit`` can
    request more history. ``before``, ``after``, and ``around`` take a message
    id and only one of them may be set.
    """
    try:
        return fetch_channel_messages(
            channel_id=channel_id,
            limit=limit,
            before=before,
            after=after,
            around=around,
            include_bots=include_bots,
        )
    except DiscordConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DiscordError as exc:
        status_code = exc.status_code if 400 <= exc.status_code <= 599 else 502
        raise HTTPException(status_code=status_code, detail=exc.message) from exc


@project_router.post(
    "/projects/{project_id}/integrations/discord",
    response_model=IntegrationStatusRead,
)
def connect_discord_channel(
    project_id: uuid.UUID,
    payload: DiscordConnect,
    db: DbSession,
) -> IntegrationStatusRead:
    """Attach one channel of a server the shared bot has joined."""
    try:
        integration = connect_discord(
            db,
            project_id,
            guild_id=payload.guild_id,
            channel_id=payload.channel_id,
        )
    except ProjectNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Project not found"},
        ) from exc
    except DiscordConfigError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "config_error", "message": str(exc)},
        ) from exc
    except DiscordError as exc:
        raise _discord_http_error(exc) from exc
    return IntegrationStatusRead.model_validate(integration)


@project_router.post(
    "/projects/{project_id}/integrations/discord/sync",
    response_model=SyncResultRead,
)
def sync_discord_channel(project_id: uuid.UUID, db: DbSession) -> SyncResultRead:
    """Import messages from the channel connected to this project."""
    try:
        integration, imported_count = sync_discord(db, project_id)
    except ProjectNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Project not found"},
        ) from exc
    except DiscordNotConnected as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "not_connected", "message": "Discord is not connected"},
        ) from exc
    except DiscordConfigError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "config_error", "message": str(exc)},
        ) from exc
    except DiscordError as exc:
        raise _discord_http_error(exc) from exc
    return SyncResultRead(
        provider=integration.provider,
        status=integration.status,
        imported_count=imported_count,
    )
