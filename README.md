# DevSync

DevSync is a project-health and coordination platform for small software teams. A team defines what it plans to build (summary, features, milestones, deliverables, deadlines). DevSync then pulls in GitHub activity and Discord discussion and compares it against that plan. The result is a dashboard showing current progress, upcoming deadlines, recent work, blockers, and likely next steps.

DevSync does not replace GitHub or Discord. It gives a higher-level view of the project that neither tool provides on its own.

## MVP

A user can:

- create a project with a description, features, milestones, and deadlines;
- connect a GitHub repository and import commits and pull-request activity;
- connect at least one Discord channel and import relevant messages;
- view a dashboard that combines the project plan with GitHub and Discord activity;
- receive an automatically generated summary of recent progress, upcoming milestones, notable activity, and next steps.

Pipeline: **project specification → external activity → structured project data → automated analysis → project-health dashboard**

## Tech stack

| Layer    | Technology                                                 |
| -------- | ---------------------------------------------------------- |
| Frontend | TypeScript, React, Next.js (App Router), Tailwind CSS      |
| Backend  | Python, FastAPI, SQLAlchemy 2, Alembic                     |
| Database | PostgreSQL 16                                              |
| DevOps   | Docker / Docker Compose, GitHub Actions                    |
| External | GitHub API, Discord API, LLM API                           |

## Repository layout

```
.
├── frontend/              Next.js app (port 3000)
│   └── src/
│       ├── app/           Routes and layouts (App Router)
│       └── lib/api.ts     Helper for calling the backend
├── backend/               FastAPI app (port 8000)
│   ├── app/
│   │   ├── main.py        App factory, CORS, router registration
│   │   ├── config.py      Settings loaded from environment / .env
│   │   ├── db.py          SQLAlchemy engine, session, Base model
│   │   └── api/routes/    One module per API area
│   ├── migrations/        Alembic database migrations
│   └── tests/             pytest suite
├── docs/                  Setup guides: Supabase, GitHub App, deployment
├── docker-compose.yml     Postgres + backend + frontend
├── render.yaml            Render blueprint for the deployed backend
└── .github/workflows/     CI (lint, type-check, test, build)
```

## Getting started

### Prerequisites

- Node.js 22 and npm (the version CI uses)
- Python 3.12+
- Docker (for Postgres, or to run the whole stack)

### Option A: run everything with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (interactive docs at http://localhost:8000/docs)
- Postgres: `localhost:5432` (user/password/db: `devsync`)

### Option B: run the servers locally (recommended for development)

Start only the database in Docker:

```bash
docker compose up -d db
```

**Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head          # apply migrations
fastapi dev app/main.py       # http://localhost:8000, auto-reload
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                   # http://localhost:3000
```

Check the backend with `GET http://localhost:8000/api/health` (reports whether the API and database are reachable). Then open http://localhost:3000, sign in with Google, and create a project. See [`docs/supabase.md`](docs/supabase.md) for sign-in setup.

## Environment variables

Defaults live in [`backend/app/config.py`](backend/app/config.py); copy `backend/.env.example` and `frontend/.env.example` to get started.

**Backend (`backend/.env`)**

| Variable | Purpose / default |
| --- | --- |
| `DATABASE_URL` | Postgres URL. Default `postgresql+psycopg://devsync:devsync@localhost:5432/devsync` |
| `CORS_ORIGINS` | JSON list of allowed frontend origins. Default `["http://localhost:3000"]` |
| `SUPABASE_URL` | Supabase project URL; used to verify login tokens |
| `SUPABASE_JWT_SECRET` | Optional; only for legacy HS256-signed projects |
| `OPENROUTER_API_KEY` | Required to generate project summaries and import specs |
| `OPENROUTER_MODEL` | OpenRouter model slug with structured-output support |
| `OPENROUTER_BASE_URL` | Default `https://openrouter.ai/api/v1` |
| `OPENROUTER_TIMEOUT_SECONDS` | Default `30` |
| `OPENROUTER_MAX_COMPLETION_TOKENS` | Default `2000` |
| `SUMMARY_MIN_INTERVAL_SECONDS` | Cooldown per project between summaries. Default `60` |
| `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG` | GitHub App credentials; see [`docs/github-app.md`](docs/github-app.md) |
| `GITHUB_BACKFILL_DAYS`, `GITHUB_SYNC_OVERLAP_HOURS`, `GITHUB_MAX_PAGES` | GitHub sync tuning. Defaults `90`, `72`, `10` |
| `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID` | Discord bot used to list channels and import messages |
| `DISCORD_CHANNEL_ID` | Optional default channel for local debugging |
| `DISCORD_IMPORT_LIMIT` | Recent messages stored per sync. Default `100` |
| `DISCORD_DEBUG_MESSAGES_ENABLED` | Keep `false` outside local debugging |

**Frontend (`frontend/.env.local`)**

| Variable | Purpose / default |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend URL. Default `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |

Never commit real `.env` files. API keys for GitHub, Discord, and the LLM provider go in `backend/.env`, and new variables should also be added to `.env.example`, this table, and `render.yaml` if the deployed backend needs them.

## Database (local Postgres + Supabase)

DevSync uses **Supabase for managed Postgres and for sign-in (Auth)** — all
API logic stays in FastAPI and Alembic owns the schema. Day-to-day you develop against the local
Docker Postgres above; the Supabase project is for shared integration and
deployment. See [`docs/supabase.md`](docs/supabase.md) for connection details,
sign-in setup, project access, and the Data API lockdown, and
[`docs/deployment.md`](docs/deployment.md) for the deployment checklist.

## Testing

The backend test suite uses pytest and needs the local Docker Postgres running with migrations applied (`docker compose up -d db`, then `alembic upgrade head`). It refuses to run against a non-local database. After installing the development dependencies shown above:

```bash
cd backend
source .venv/bin/activate
pytest
```

To run one test file or tests matching a name:

```bash
pytest tests/test_github.py
pytest -k health
```

A few tests are still marked as skipped because the behaviour they describe is not built yet (each skip reason says why). When you build that feature, replace the skeleton with real setup and assertions and remove the skip marker.

The frontend test suite uses Vitest and Testing Library. Run the component and page tests with:

```bash
cd frontend
npm test
```

Use `npm run test:watch` while implementing frontend features. Scenarios for features that are not built yet are marked with `test.todo`; replace each TODO with rendering, user interactions, and assertions when you build it.

### Test coverage

Statement coverage was measured on November 19, 2026 across the backend `app/`
package and all frontend TypeScript/TSX files under `src/`.

| Codebase | Statement coverage | Test result |
| -------- | -----------------: | ----------- |
| Backend  | **93%** (2,190 of 2,349 statements) | 262 passed, 16 skipped |
| Frontend | **88.66%** | 251 passed, 11 TODO |

The reports were generated with:

```bash
# Backend
cd backend
coverage run --source=app -m pytest
coverage report -m

# Frontend
cd frontend
npx vitest run --coverage --coverage.include='src/**/*.{ts,tsx}'
```

## Common tasks

| Task                    | Command                                                      |
| ----------------------- | ------------------------------------------------------------ |
| Backend tests           | `cd backend && pytest`                                       |
| Backend lint / format   | `ruff check . && ruff format .`                              |
| New migration           | `alembic revision --autogenerate -m "add projects table"`    |
| Apply migrations        | `alembic upgrade head`                                       |
| Frontend tests          | `cd frontend && npm test`                                    |
| Frontend lint           | `cd frontend && npm run lint`                                |
| Frontend type-check     | `npx tsc --noEmit`                                           |
| Frontend production build | `npm run build`                                            |

To add an API area, create a module in `backend/app/api/routes/` with an `APIRouter` and register it in `app/main.py`. To add a model, subclass `Base` from `app/db.py`, make sure it is imported before Alembic runs, and generate a migration.

## Roadmap

**Done:** project creation and spec import, sign-in and per-project access, GitHub and Discord integrations, LLM project-health summaries with blockers and next steps, milestones and deliverable tracking, deployment (Vercel + Render + Supabase).

**Next:** richer health analysis (per-feature activity, date ranges, supporting evidence), milestone owners and recommended actions, and optionally meeting-transcript processing, a client-facing dashboard, and advanced repository-health metrics.

## Metrics: landing-page button experiment

The landing page's main **"Sign in with Google"** button comes in three colors: **blue**, **green**, **dark grey**. A click counts as a conversion. An **epsilon-greedy multi-armed bandit** picks the color for each new visitor:

- **90%:** the color with the best click rate so far, `(clicks + 1) / (views + 1)`
- **10%:** a random color, so every color keeps getting tested

**Flow:** the page calls `POST /api/experiments/landing-signin-color/assign` (+1 view) and shows that color for the session. On click it calls `POST /api/experiments/landing-signin-color/convert` (+1 click). Results: `GET /api/experiments/landing-signin-color`.

| Part | File |
|---|---|
| Bandit | [`backend/app/experiments/bandit.py`](backend/app/experiments/bandit.py) |
| API endpoints | [`backend/app/api/routes/experiments.py`](backend/app/api/routes/experiments.py) |
| Stored counts | [`backend/app/models/experiment_variant.py`](backend/app/models/experiment_variant.py) |
| Landing button | [`frontend/src/components/SignInExperiment/SignInExperiment.tsx`](frontend/src/components/SignInExperiment/SignInExperiment.tsx) |
| Tests | [`test_bandit.py`](backend/tests/test_bandit.py), [`test_experiments.py`](backend/tests/test_experiments.py), [`sign-in-experiment.test.tsx`](frontend/tests/sign-in-experiment.test.tsx) |

**Limitations:** the endpoints are public (visitors aren't signed in), so counts could be inflated.


## Team

| Name             | Contact                                  |
| ---------------- | ----------------------------------------- |
| Andrew Savoie    | andrew.savoie@yale.edu (primary contact) |
| Miguel Cuevas    | miguel.cuevas@yale.edu                   |
| Eric Wang        | eric.wang.ejw68@yale.edu                 |
| Sid Kancharapu   | sid.kancharapu@yale.edu                  |
| Daniel Lee       | daniel.lee.dyl27@yale.edu                |
| Shaunak Pandey   | shaunak.pandey@yale.edu                  |
| Lena Olszewska   | lena.olszewska@yale.edu                  |
