# /deploy-verify: Railway deploy + production smoke test

The full WikiRace ship loop as one command (this sequence was previously re-typed by hand every deploy; see docs/DEPLOY.md for background).

## Steps

1. **Pre-flight** (abort with a report if any fails):
   - `git status`: no uncommitted changes to deployable code (untracked docs/scratch are fine; call them out).
   - Confirm current branch and that it's what Bo intends to ship; if not `main`, ask.
   - Local image check: `docker build -t wikirace-smoke .` succeeds.
   - `.railwayignore` sanity (if the repo has one): confirm no pattern excludes `artifacts/` app dirs (see docs/DEPLOY.md "Railway Build Rules").
2. **Deploy**: `railway up` from the repo root. Stream/watch the build logs; if the build fails, diagnose against the Railway Build Rules checklist BEFORE retrying (globs → Docker context → SPA routing, in that order).
3. **Smoke-test production** (get the domain via `railway domain` or `railway status`):
   - `GET /` → 200
   - `GET /daily` (SPA deep link) → 200 with the app HTML, not a 404
   - `GET /api/healthz` → 200
4. **Report**: deploy status, verified production URL, the three smoke results, and any config changes made. Fail-closed: do NOT declare success unless all three checks pass.

## Never
- Never deploy via Vercel or Replit (legacy; see CLAUDE.md Deployment Reality Check).
- Never skip the SPA deep-link check: `/` working while deep links 404 is the known failure mode.
