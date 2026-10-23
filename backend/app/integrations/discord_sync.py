"""Connect a project to a channel the shared Discord bot can read."""

import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.integrations.discord import verify_channel_access
from app.models.enums import IntegrationProvider, IntegrationState
from app.models.integration import Integration
from app.models.project import Project


class ProjectNotFound(Exception):
    """Raised when the project id does not exist."""


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
    integration = db.scalars(
        select(Integration).where(
            Integration.project_id == project.id,
            Integration.provider == IntegrationProvider.DISCORD,
        )
    ).first()
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
