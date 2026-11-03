# Supabase setup

DevSync uses Supabase as **managed Postgres** and for **Auth** (Google sign-in).
All API logic stays in the FastAPI backend; Alembic owns the schema. The
Supabase dashboard is not used to add or modify tables.

## Auth (Google sign-in)

The frontend signs users in with `@supabase/ssr` (Google OAuth) and sends the
Supabase access token to FastAPI as `Authorization: Bearer <token>`. The
backend (`backend/app/auth.py`) verifies the token's signature, expiry,
audience (`authenticated`) and issuer. Only `GET /api/health` is public.

One-time setup (project owner):

1. **Google Cloud Console** → APIs & Services → Credentials → create an OAuth
   client ID (Web application). Add the authorized redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Supabase** → Authentication → Providers → Google: enable it and paste the
   client ID and secret.
3. **Supabase** → Authentication → URL Configuration: set the Site URL and add
   `http://localhost:3000/auth/callback` (plus the deployed URL) to the
   redirect allow-list.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the
   frontend and `SUPABASE_URL` for the backend (see the README table).

Token verification uses the project's JWKS (asymmetric signing keys). Projects
that still use the legacy shared secret can set `SUPABASE_JWT_SECRET` instead.

## When you need Supabase

- **Everyday development:** you do not. Use the local Docker Postgres
  (`docker compose up -d db`). It is faster, free, and offline.
- **Shared integration environment:** we have one shared Supabase project. Use
  it when you need to share data with another teammate or test against a
  real hosted database.
- **Deployment:** the deployed backend reads its `DATABASE_URL` from the same
  shared project (or a separate production project if we add one).

## Pointing the backend at Supabase

1. Sign in to the shared Supabase project (ask the team for an invite).
2. Open **Project Settings → Database → Connection string**.
3. Under **Session pooler**, choose **URI**. The template looks like
   `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`.
4. Replace `[YOUR-PASSWORD]` with the database password set when the project
   was created (available in the password manager we share, or ask the owner).
5. Prefix the scheme with `postgresql+psycopg://` so SQLAlchemy uses the right
   driver. Put the result in `backend/.env` as `DATABASE_URL=...`.
6. Run `alembic upgrade head` to apply migrations to that Supabase database.

Use the **Session pooler** (port 5432), not the Transaction pooler (port 6543).
Transaction pooling breaks prepared statements, which SQLAlchemy relies on.

## What NOT to do

- **Do not** edit tables, columns, or enums through the Supabase dashboard.
  All schema changes go through Alembic migrations in `backend/migrations/`.
- **Do not** commit the service-role key, the database password, or the
  connection string to the repo. They belong in `backend/.env`
  (gitignored) or in deployment secrets.
- **Do not** use the frontend Supabase client for data access. It is for
  sign-in/out only; data goes through FastAPI. Our model keeps integration
  tokens server-side.

## Open decisions (flag in team review)

- **Per-user data ownership.** Signed-in users currently all see the same
  projects. Adding `owner_id` to projects and scoping queries is a follow-up.
- **Row-level security.** If we use Supabase Auth, RLS policies can enforce
  project-membership scoping at the database. For now the backend is trusted
  and no RLS is set.
- **Integration credential storage.** The `integrations` table has a non-secret
  `config` column but no credential column. Encryption design is deferred until
  the auth owner is ready to add it.
