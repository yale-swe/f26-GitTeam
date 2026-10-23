"""Connect a project to a channel the shared Discord bot can read, then sync it."""

import uuid
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.integrations.discord import (
    MAX_LIMIT,
    DiscordConfigError,
    DiscordError,
    DiscordMessage,
    fetch_channel_messages,
    verify_channel_access,
)
from app.models.activity import ActivityItem
from app.models.enums import IntegrationProvider, IntegrationState
from app.models.integration import Integration
from app.models.project import Project


class ProjectNotFound(Exception):
    """Raised when the project id does not exist."""


class DiscordNotConnected(Exception):
    """Raised when a project has no Discord channel yet."""


def connect_discord(
    db: Session,
    project_id: uuid.UUID,
    *,
    guild_id: str,
    channel_id: str,
    client: httpx.Client | None = None,
) -> Integration:
    """Associate one guild channel with a project after the shared bot can see it.

    The bot token is not stored on the project. Inviting the bot to a server is
    what grants access; this records which channel that project should sync.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise ProjectNotFound()

    channel = verify_channel_access(
        guild_id=guild_id,
        channel_id=channel_id,
        token=settings.discord_bot_token,
        client=client,
    )
    integration = _discord_integration(db, project.id)
    same_channel = integration is not None and integration.config.get("channel_id") == channel.id
    if integration is None:
        integration = Integration(
            project_id=project.id,
            provider=IntegrationProvider.DISCORD,
            status=IntegrationState.CONNECTED,
            config={},
        )
        db.add(integration)

    integration.config = {
        "guild_id": channel.guild_id,
        "channel_id": channel.id,
        "channel_name": channel.name,
    }
    integration.status = IntegrationState.CONNECTED
    integration.last_sync_error = None
    if not same_channel:
        integration.last_successful_sync_at = None
    db.commit()
    db.refresh(integration)
    return integration


def sync_discord(
    db: Session,
    project_id: uuid.UUID,
    *,
    client: httpx.Client | None = None,
) -> tuple[Integration, int]:
    """Import human messages from the project's channel into activity items.

    Rows are keyed by Discord message id, so syncing the same history again
    updates the existing activity instead of inserting a duplicate.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise ProjectNotFound()

    integration = _discord_integration(db, project.id)
    if integration is None:
        raise DiscordNotConnected()
    channel_id = str(integration.config.get("channel_id") or "")
    guild_id = str(integration.config.get("guild_id") or "")
    if not channel_id:
        raise DiscordNotConnected()

    limit = settings.discord_import_limit
    if limit < 1 or limit > MAX_LIMIT:
        raise DiscordConfigError(f"DISCORD_IMPORT_LIMIT must be between 1 and {MAX_LIMIT}")

    try:
        messages = fetch_channel_messages(
            channel_id=channel_id,
            limit=limit,
            include_bots=False,
            token=settings.discord_bot_token,
            client=client,
        )
        rows = [
            _activity_row(project.id, guild_id, channel_id, message)
            for message in messages
            if not message.author_bot and message.channel_id == channel_id
        ]
    except DiscordError as exc:
        integration.status = IntegrationState.FAILED
        integration.last_sync_error = exc.message
        db.commit()
        raise
    if rows:
        stmt = insert(ActivityItem).values(rows)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_activity_items_source",
            set_={
                "kind": stmt.excluded.kind,
                "occurred_at": stmt.excluded.occurred_at,
                "title": stmt.excluded.title,
                "url": stmt.excluded.url,
                "details": stmt.excluded.details,
            },
        )
        db.execute(stmt)

    integration.status = IntegrationState.HEALTHY
    integration.last_sync_error = None
    integration.last_successful_sync_at = datetime.now(UTC)
    db.commit()
    db.refresh(integration)
    return integration, len(rows)


def _discord_integration(db: Session, project_id: uuid.UUID) -> Integration | None:
    return db.scalars(
        select(Integration).where(
            Integration.project_id == project_id,
            Integration.provider == IntegrationProvider.DISCORD,
        )
    ).first()


def _activity_row(
    project_id: uuid.UUID,
    guild_id: str,
    channel_id: str,
    message: DiscordMessage,
) -> dict:
    guild = message.guild_id or guild_id
    return {
        "id": uuid.uuid4(),
        "project_id": project_id,
        "source": IntegrationProvider.DISCORD.value,
        "source_id": message.id,
        "kind": "message",
        "occurred_at": _occurred_at(message),
        "title": _title(message),
        "url": f"https://discord.com/channels/{guild}/{message.channel_id}/{message.id}",
        "details": {
            "guild_id": guild,
            "channel_id": message.channel_id,
            "author_id": message.author_id,
            "author_name": message.author_name,
            "content": message.content,
            "attachments": [item.model_dump() for item in message.attachments],
        },
    }


def _title(message: DiscordMessage) -> str:
    text = message.content.strip()
    if not text and message.attachments:
        text = message.attachments[0].filename or "Attachment"
    if not text:
        text = "Discord message"
    if len(text) <= 240:
        return text
    return text[:239] + "…"


def _occurred_at(message: DiscordMessage) -> datetime:
    raw = message.timestamp.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise DiscordError(502, "Discord returned a message with an invalid timestamp") from exc
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed
