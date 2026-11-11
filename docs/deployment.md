# Deployment checklist

DevSync has four pieces:

- **Next.js frontend** → deployed on **Vercel**.
- **FastAPI backend** → deployed on **Render** (Docker).
- **Postgres + Auth** → **Supabase** (same project used for dev).
- **Sign-in provider** → **Google** via Supabase Auth.

`docker-compose.yml` is for local development only. These steps bring a real
deployment up for the first time.

## 0. One-time prerequisites

- A Supabase project with the Alembic migrations already applied
  (`alembic upgrade head`). See `docs/supabase.md`.
- GitHub access to `yale-swe/f26-GitTeam`.
- Accounts on [Vercel](https://vercel.com) and [Render](https://render.com)
  (both free tiers are enough). Sign in to both with GitHub so they can see
  the repo.

## 1. Deploy the backend to Render

1. Render dashboard → **New → Blueprint** and point it at the repo.
   Render reads `render.yaml` at the repo root and proposes a web service
   named `devsync-backend` built from `backend/Dockerfile`.
2. When Render prompts for the `sync: false` environment variables, fill in:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase **Session pooler** URI (port 5432), prefixed `postgresql+psycopg://`. See `docs/supabase.md`. |
   | `CORS_ORIGINS` | JSON list with the Vercel URL once you know it. Temporarily `["http://localhost:3000"]`; update after step 2. |
   | `SUPABASE_URL` | Project URL, `https://<project-ref>.supabase.co`. |
   | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | For progress summaries. Model must support structured outputs. |
   | `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID` | For Discord connect + sync. |
   | `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG` | For GitHub connect + sync, from the production GitHub App. See `docs/github-app.md`. |
   | `SUPABASE_JWT_SECRET` | Leave empty unless the project uses the legacy HS256 secret. |

3. Click **Apply**. The first build takes ~5 min. When it finishes, Render
   gives you a URL like `https://devsync-backend.onrender.com`.
4. Hit `https://devsync-backend.onrender.com/api/health` — it should return
   `{"status":"ok","database":"ok"}`.

**Free tier note.** Render's free web service sleeps after 15 min of
inactivity. The next request takes ~30 s to spin it back up. This is fine
for a demo but worth mentioning if a reviewer sees the first request hang.

## 2. Deploy the frontend to Vercel

1. Vercel dashboard → **Add New → Project**, import `yale-swe/f26-GitTeam`.
2. Set **Root Directory** to `frontend`. Vercel auto-detects Next.js — leave
   the build/install commands as the defaults.
3. Under **Environment Variables**, add the three `NEXT_PUBLIC_*` values.
   They are build-time: Vercel will inline them when it runs `next build`,
   so they must exist before the first deploy.

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | Render backend URL from step 1, e.g. `https://devsync-backend.onrender.com`. No trailing slash. |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **publishable** (anon) key. Public by design; never use the service_role key. |

4. Click **Deploy**. Vercel gives you a URL like
   `https://f26-git-team.vercel.app` (or similar).

## 3. Close the CORS loop

Back in the Render dashboard, edit `CORS_ORIGINS` to the Vercel URL:

```
["https://<your-vercel-domain>.vercel.app"]
```

Render redeploys automatically. Without this step the browser will block
every API call with a CORS error.

## 4. Supabase dashboard

- **Authentication → URL Configuration**
  - **Site URL**: the Vercel URL.
  - **Redirect URLs**: add `https://<vercel-domain>/auth/callback`. Keep
    the `http://localhost:3000/auth/callback` entry so local dev still works.

## 5. Google Cloud Console

- **APIs & Services → Credentials → OAuth 2.0 Client ID**: the authorized
  redirect URI stays `https://<project-ref>.supabase.co/auth/v1/callback`.
  (Supabase handles the hop to your app.)
- **OAuth consent screen**: move the app from **Testing** to **In production**.
  In Testing, only listed test users can sign in.
  If Google asks for authorized domains, add `supabase.co`.

## 6. GitHub App

- Set the production app's **Redirect URI** to
  `https://<vercel-domain>/integrations/github/callback`. See
  `docs/github-app.md`.

## 7. Smoke test the live deployment

- `GET <backend>/api/health` → 200, `"database": "ok"`.
- `GET <backend>/api/projects` without a token → 401.
- Open the Vercel URL, sign in with Google, land on `/projects`.
- Sign in with a second Google account → cannot see the first account's
  projects (`404 not_found`).
- The Supabase Data API stays locked down. This must return an error (e.g.
  `permission denied`, code `42501`) or an empty result — never rows:

  ```bash
  curl "$SUPABASE_URL/rest/v1/projects?select=id&limit=1" \
       -H "apikey: $PUBLISHABLE_KEY"
  ```

## 8. When the schema changes later

The backend does **not** run migrations on start. After a migration lands on
`main`, run `alembic upgrade head` against the Supabase `DATABASE_URL`
before the new backend code is deployed. The simplest way is from a laptop
with `backend/.env` pointed at Supabase; a Render **Shell** on the running
service works too.
