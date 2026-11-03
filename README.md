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
├── docker-compose.yml     Postgres + backend + frontend
└── .github/workflows/     CI (lint, type-check, test, build)
```

## Getting started

### Prerequisites

- Node.js 20+ and npm
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

The home page calls `GET /api/health` and shows whether the backend and database are reachable.

## Environment variables

| Variable              | Where               | Default                                                      |
| --------------------- | ------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`        | `backend/.env`      | `postgresql+psycopg://devsync:devsync@localhost:5432/devsync` |
| `CORS_ORIGINS`        | `backend/.env`      | `["http://localhost:3000"]`                                  |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8000`                                    |
| `NEXT_PUBLIC_SUPABASE_URL` | `frontend/.env.local` | `https://<project-ref>.supabase.co`                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `frontend/.env.local` | Supabase publishable (anon) key                 |
| `SUPABASE_URL`        | `backend/.env`      | Same project URL; used to verify login tokens                |
| `SUPABASE_JWT_SECRET` | `backend/.env`      | Optional; only for legacy HS256-signed projects              |

Never commit real `.env` files. API keys for GitHub, Discord, and the LLM provider go in `backend/.env`, and new variables should also be added to `.env.example`.

## Database (local Postgres + Supabase)

DevSync uses **Supabase as managed Postgres only** — all API logic stays in
FastAPI and Alembic owns the schema. Day-to-day you develop against the local
Docker Postgres above; the Supabase project is for shared integration and
deployment. See [`docs/supabase.md`](docs/supabase.md) for connection details
and the open decisions this leaves for the team (auth, RLS, credential
storage).

## Testing

The backend test suite uses pytest. After installing the development dependencies shown above, run the complete suite from the repository root:

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

Tests for features that have not been implemented yet are marked as skipped. Replace each skeleton with real setup and assertions, then remove its skip marker as the corresponding backend feature is added.

The frontend test suite uses Vitest and Testing Library. Run the planned component and page tests with:

```bash
cd frontend
npm test
```

Use `npm run test:watch` while implementing frontend features. Unimplemented frontend scenarios are marked with `test.todo`; replace each TODO with rendering, user interactions, and assertions as its page is built.

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

1. Project creation and basic dashboard
2. GitHub integration
3. Discord integration
4. Automated status and milestone analysis
5. Optional: meeting-transcript processing, client-facing dashboard, advanced repository-health metrics

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
