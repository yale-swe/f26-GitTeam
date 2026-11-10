from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import discord, health, projects, summaries
from app.auth import get_current_user
from app.config import settings

app = FastAPI(title="DevSync API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# `/api/health` stays public (liveness probe); everything else needs a Supabase
# access token. `/api/health/score` is protected inside the health router.
protected = [Depends(get_current_user)]

app.include_router(health.router, prefix="/api")
app.include_router(discord.router, prefix="/api", dependencies=protected)
app.include_router(discord.project_router, prefix="/api", dependencies=protected)
app.include_router(projects.router, prefix="/api", dependencies=protected)
app.include_router(summaries.router, prefix="/api", dependencies=protected)
