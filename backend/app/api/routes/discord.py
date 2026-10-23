from fastapi import APIRouter, HTTPException, Query

from app.integrations.discord import (
    MAX_LIMIT,
    DiscordConfigError,
    DiscordError,
    DiscordMessage,
    bot_invite_url,
    fetch_channel_messages,
)
from app.schemas.integration import DiscordInvite

router = APIRouter(prefix="/discord", tags=["discord"])


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
