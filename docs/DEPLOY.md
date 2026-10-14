# WikiRace deploy runbook

Current state (July 2026): the web app ran on Railway against one hosted
Supabase project, and the Expo client used that same project. In this public
export, `<project-ref>` stands for your Supabase project ref and
`<your-app-host>` for your deployed web host. Configure auth providers only on
the project the app actually uses.

## 1. Confirm the hosted Supabase project (Bo only)

Open the current project and confirm it is healthy before schema, provider, or
secret work:

1. Open `https://supabase.com/dashboard/project/<project-ref>`.
2. If Supabase reports it paused, click **Restore project** and wait for it to
   become healthy.

Do not configure the legacy Replit-era Supabase project. The Replit config
files were removed from this public export and are not the production source
of truth.

## 2. Apply the schema

From the repo root, after `supabase login`:

```sh
supabase link --project-ref <project-ref>          # asks for the DB password
supabase db push                                    # applies supabase/migrations/*
```

The migration is idempotent and upgrades the earlier hand-applied schema
(not included in this export) in place (adds friend codes, streak columns,
`game_moves` audit table, `friend_challenges`, server-only write policies,
new leaderboard RPCs). Nothing is dropped or deleted.

## 3. Auth settings (Supabase dashboard → Authentication)

- **Sign In / Up → Email → Confirm email: OFF**: friends should be able to
  sign up and play immediately. (If you'd rather keep confirmations, wire up
  custom SMTP first; the built-in sender is capped at ~3 emails/hour.)
- **URL Configuration → Site URL**: the deployed URL (for example
  `https://<your-app-host>`), and add it to Redirect URLs. Keep the production
  host stable once challenge links are shared.

## 4. Retrieve hosted keys (Bo only)

Get the keys (prints secrets; run yourself):

```sh
supabase projects api-keys --project-ref <project-ref>
```

Enter them only in the Railway service variables described below. Do not put
them in chat, tracked files, Replit, or Vercel.

## 5. Ship: Railway (primary)

The app deploys as ONE service: the root `Dockerfile` builds the frontend
and the API and the API serves both (verified locally: image builds and
serves `/`, SPA routes, `/api/*`). `railway.json` sets the health check to
`/api/healthz`.

From the repo root, after `railway login` and `railway link`:

```sh
railway status        # confirm the existing linked WikiRace production service
railway up            # build + deploy the Dockerfile
```

Service variables (Railway → service → Variables; the two `VITE_*` ones are
consumed as Docker build args, the rest at runtime):

| Variable                    | Value                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | project URL (build-time; baked into the client bundle)                                                                                        |
| `VITE_SUPABASE_ANON_KEY`    | anon key (build-time; public by design; it ships in the client bundle, which is why the Docker "secrets in ARG" warning is a false positive) |
| `VITE_GOOGLE_AUTH_ENABLED`  | build-time feature flag; leave unset/empty to keep Google auth hidden, set to `true` to expose the button                                    |
| `SUPABASE_URL`              | project URL                                                                                                                                   |
| `SUPABASE_ANON_KEY`         | anon key                                                                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**required**; the API server is the only game writer)                                                                       |
| `PUBLIC_APP_URL`            | public web origin used in challenge links and preview metadata (defaults to the placeholder `https://wikirace.example.com`)                  |
| `APPLE_TEAM_ID`             | Apple Team ID for the iOS universal-link file at `/.well-known/apple-app-site-association`; empty by default, which serves a file with no app |
| `LOG_LEVEL`                 | optional pino log level                                                                                                                       |

Railway injects `PORT` automatically. After deploy, set the Supabase Site
URL (step 3) to the Railway domain.

### Railway Build Rules (learned the hard way: check before every deploy)

- **`.railwayignore` globs**: patterns match relative to the repo root and can
  silently exclude nested application code (a bare `dist` also matches
  `artifacts/*/dist`). Use root-relative paths (leading `/`) for anything that
  should only match at the top level, and after editing verify the build
  context still contains the app dirs.
- **SPA routing**: the API serves the frontend, and every non-`/api/*` route
  must fall through to `index.html` (catch-all), or deep links 404 in
  production while `/` works fine. Test a non-root route (e.g. `/daily`)
  directly after every deploy.
- **Docker build context**: the root `Dockerfile` builds frontend + API
  together. Before `railway up`, confirm the image builds locally and serves
  `/`, a SPA route, and `/api/healthz`.
- **Legacy platforms**: never deploy via Replit or Vercel; production is
  Railway only (see CLAUDE.md "Deployment Reality Check").

Smoke test on a phone: sign up → play the daily → check the leaderboard →
share a challenge link → open it in a private window.

### Replit (historical only)

Do not deploy or configure auth through Replit. The Replit config pointed at
the legacy Supabase project and is not part of this public export. Production
is the Railway service plus the hosted Supabase project described above.

## Local development

```sh
supabase start                      # local auth+db (Docker)
supabase db push --local            # only needed on a fresh stack
# env files (git-ignored): artifacts/web/.env.local needs
#   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
# artifacts/api-server/.env.local needs
#   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
# (values come from `supabase status`)

cd artifacts/api-server && pnpm build && PORT=8081 pnpm start
cd artifacts/web        && PORT=5173 BASE_PATH=/ API_PROXY_TARGET=http://localhost:8081 pnpm dev
```

Tests:

```sh
cd artifacts/api-server && pnpm test        # vitest: game logic units
cd artifacts/web        && pnpm test:e2e    # Playwright: browser happy path (needs the stack above)
```
