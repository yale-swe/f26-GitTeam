# GitHub App setup

DevSync reads a project's commits and pull requests through a **GitHub App**.
The app's credentials live in the backend's environment. Each project stores
only its installation id and the selected repository's public details in
`integrations.config`. Installation tokens last an hour, are kept in memory,
and are never written to the database.

Use two apps: a **dev** app for local work and a **production** app for the
deployed site. They differ only in the URLs and in who can install them.

## 1. Create the app

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**
(<https://github.com/settings/apps/new>).

| Setting | Dev app | Production app |
|---|---|---|
| Name (must be unique on GitHub) | `DevSync Dev (<your-username>)` | `DevSync` |
| Homepage URL | `http://localhost:3000` | the Vercel URL |
| Redirect URI ("Callback URL" in older GitHub docs) | `http://localhost:3000/integrations/github/callback` | `https://<vercel-domain>/integrations/github/callback` |
| Where can it be installed? | Only on this account | Any account |

Same for both:

- ✅ **Request user authorization (OAuth) during installation.** DevSync uses
  the one-time code from this step to check that the person connecting can
  actually see the installation.
- ✅ **Redirect on update**, so changing the repository selection on GitHub
  also returns to DevSync.
- **Webhook:** uncheck **Active**. DevSync syncs on demand.
- **Repository permissions:** Contents **Read-only**, Pull requests
  **Read-only**, Metadata **Read-only**. Nothing else, and no account
  permissions.

After creating it:

1. Note the **Client ID** and the **slug** (the last part of
   `https://github.com/apps/<slug>`).
2. **Generate a client secret.**
3. **Generate a private key.** A `.pem` file downloads. Keep it outside the
   repo (for example `~/.config/devsync/`). Never commit it.

## 2. Environment variables

Set these in `backend/.env` locally, or in the Render dashboard for production.

| Variable | Value |
|---|---|
| `GITHUB_APP_CLIENT_ID` | Client ID from step 1 |
| `GITHUB_APP_CLIENT_SECRET` | Client secret from step 1 |
| `GITHUB_APP_PRIVATE_KEY` | The `.pem` contents on one line (below) |
| `GITHUB_APP_SLUG` | The app's slug |

Convert the key to one line with literal `\n` escapes:

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n", $0}' path/to/key.pem
```

The sync settings `GITHUB_BACKFILL_DAYS` (90), `GITHUB_SYNC_OVERLAP_HOURS`
(72) and `GITHUB_MAX_PAGES` (10 pages of 100) have working defaults.

## 3. Check it end to end (local)

1. Install the dev app on a test repository that has a few commits and pull
   requests.
2. Start the backend and frontend (see the README), sign in, and create a
   project.
3. On **Project health**, click **Connect GitHub**. GitHub asks you to install
   the app and pick repositories, then returns to
   `/integrations/github/callback`.
4. With one repository, DevSync selects it and runs the first sync. With
   several, pick one. You land back on **Project health**.
5. The **Recent GitHub work** card lists commits and pull requests, and the
   sidebar shows GitHub as healthy. **Sync now** imports anything new.

## Production notes

- Installing an app on an **organization** (such as `yale-swe`) needs an
  organization owner. If a member tries, GitHub sends an install request
  instead, and DevSync says an owner has to approve it.
- Uninstalling the app on GitHub, or removing the repository from it, revokes
  access. The next sync marks GitHub as **failed**.

## What the statuses mean

| Status | Meaning | What to do |
|---|---|---|
| `connected` | App installed; not synced yet | Click **Sync now** |
| `healthy` | Last sync succeeded | Nothing |
| `stale` | GitHub was rate-limited or unreachable | Try again later |
| `failed` | Access was revoked or the repository is gone | Connect GitHub again |

A failed sync never deletes imported activity, but the dashboard only shows
GitHub activity while the status is `healthy`, so stale data is never
presented as current.

Disconnecting (`DELETE /api/projects/{id}/integrations/github`) and switching
repositories both delete that project's imported GitHub activity. Discord
activity and other projects are not touched.
