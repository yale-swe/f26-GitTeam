# Supabase setup

DevSync uses **Supabase as managed Postgres only**. All API logic stays in the
FastAPI backend; Alembic owns the schema. The Supabase dashboard is not used to
add or modify tables.

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
- **Do not** connect the frontend directly to Supabase (e.g. with
  `@supabase/supabase-js`) without discussing it first. Our model keeps
  integration tokens server-side.

## Open decisions (flag in team review)

- **Auth model.** Supabase Auth gives us JWT issuance and user management
  cheaply, but we have not committed to it. The auth owner (Miguel) decides
  whether DevSync verifies Supabase JWTs or runs its own auth.
- **Row-level security.** If we use Supabase Auth, RLS policies can enforce
  project-membership scoping at the database. For now the backend is trusted
  and no RLS is set.
- **Integration credential storage.** The `integrations` table has a non-secret
  `config` column but no credential column. Encryption design is deferred until
  the auth owner is ready to add it.
