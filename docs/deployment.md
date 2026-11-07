# Deployment checklist

DevSync has four pieces: the Next.js frontend, the FastAPI backend, Supabase
(Postgres and Auth), and Google as the sign-in provider. `docker-compose.yml`
is for local development only. This page lists what to fill in for a real
deployment. No hosting provider is chosen yet; the values below are the same
for any of them.

## 1. Backend environment (runtime secrets)

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **Session pooler** URI (port 5432), prefixed `postgresql+psycopg://`. See `docs/supabase.md`. |
| `CORS_ORIGINS` | JSON list with the deployed frontend origin, e.g. `["https://app.example.com"]`. No trailing slash. |
| `SUPABASE_URL` | Project URL, `https://<project-ref>.supabase.co`. Paths such as `/rest/v1` are stripped automatically. |
| `SUPABASE_JWT_SECRET` | Leave empty unless the project still uses the legacy HS256 secret. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Needed for progress summaries. The model must support structured outputs. |
| `SUMMARY_MIN_INTERVAL_SECONDS` | Cooldown per project between summaries (default 60). Each one costs OpenRouter credits. |
| `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID` | Needed for Discord connect and sync. |
| `DISCORD_DEBUG_MESSAGES_ENABLED` | Keep `false`. When true, any signed-in user can read any channel the bot can see. |
| `GITHUB_APP_*` | Only when the GitHub integration routes exist (the client is library code today). |

Store these as the host's secrets, never in the repo.

## 2. Frontend environment (set at build time)

`NEXT_PUBLIC_*` values are baked into the bundle, so they must exist when the
frontend is **built**, not just when it runs.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Public URL of the deployed backend. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key. Public by design; never use the secret or `service_role` key. |

## 3. Supabase dashboard

- **Authentication → URL Configuration:** set **Site URL** to the frontend URL and add
  `https://<frontend>/auth/callback` to **Redirect URLs** (keep the localhost entry for development).
- **Authentication → Providers → Google:** enabled, with your Google client ID and secret.

## 4. Google Cloud Console

- The authorized redirect URI stays `https://<project-ref>.supabase.co/auth/v1/callback`.
- **OAuth consent screen:** move the app from **Testing** to **In production**. In Testing, only
  listed test users can sign in. If Google asks for authorized domains, add `supabase.co`.

## 5. Release steps, in order

1. Build and deploy the backend image.
2. With `DATABASE_URL` pointing at Supabase, run `alembic upgrade head` from the backend image. The
   backend does not run migrations on start. This also applies the Data API lockdown
   (`docs/supabase.md`), so run it **before** the site is public.
3. Backfill existing projects (see "Project access" in `docs/supabase.md`) if the database already has
   any.
4. Build and deploy the frontend with the `NEXT_PUBLIC_*` values above.

## 6. After deploying, check

- `GET <backend>/api/health` returns 200 with `"database": "ok"`.
- `GET <backend>/api/projects` without a token returns 401.
- Signing in with Google lands on `/projects`, and a second Google account cannot see the first
  account's projects.
- The database is closed to the public key. This should return an error such as `permission denied`
  (code `42501`) or an empty result, never rows:
  `curl "<SUPABASE_URL>/rest/v1/projects?select=id&limit=1" -H "apikey: <publishable key>"`
