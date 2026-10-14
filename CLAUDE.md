## Deployment Reality Check

- **The public product is WikiRace.** Deployable packages are
  `artifacts/mobile`, `artifacts/web`, and `artifacts/api-server`. Read
  `docs/PROJECT_MAP.md` before source, local-root, worktree, or external display
  renames. Stable legacy IDs and URLs must remain exact.
- **Production is Railway + hosted Supabase:** one Railway service built from the root `Dockerfile`, health check `/api/healthz`. See `docs/DEPLOY.md` (including "Railway Build Rules") before touching deploy config.
- **Replit and Vercel are legacy.** The project moved off both platforms. Their config files and the pre-rebuild Next.js backup are not part of this public export. Never deploy through Replit or Vercel, and don't diagnose deploy failures against them. If a Vercel/Replit integration fires, disconnect it rather than fixing it.
- Local dev server squats on port 8080 sometimes conflict with other projects' Playwright runs. Kill it when done (`lsof -ti :8080 | xargs kill`).

## iOS Release Rules (learned 2026-07-15/16)

- **Never `eas submit` without `ascAppId` pinned** in `artifacts/mobile/eas.json`
  (this public export ships a placeholder; set your own App Store Connect app
  ID). Unpinned submits run EAS's "ensure app exists" step, which auto-creates
  a TestFlight group and auto-invites every App Store Connect user on the
  Apple developer team.
- **iOS bundle ID is `com.boabrams.wikirace`.** The original
  `com.boabrams.wikipath` is permanently bound to a removed ASC app record and
  can never back a new app, so do not switch back. Android keeps
  `com.boabrams.wikipath`.
- **Distribution is explicit-approval-only:** internal TestFlight = Bo alone;
  friends join via the external group's capped public link, which only works
  after first-build Beta App Review; disable the link once the intended
  testers are in.
- **`expo export` and simulator runs never compile Swift.** The EAS build is
  the first true native compile. Keep native deps SDK-aligned; no canary
  packages (an unused `@expo/ui` canary broke the first production build).
- **EAS submissions can wedge IN_QUEUE.** Query EAS GraphQL
  (`submissions.byId`, CLI session token from `~/.expo/state.json`), cancel,
  and re-queue instead of waiting.

## Claude ↔ Codex Collaboration

This repo uses the two-agent workflow: Claude Opus plans + reviews, Codex implements.

**Claude's role in this repo:**
- Read `docs/ai/task.md` → produce `docs/ai/architecture.md` via `/architect`
- For large/high-risk planning, use `/ultraplan`, then capture the approved plan in `docs/ai/architecture.md`
- Launch Codex implementation via `/implement-codex` when Bo wants Codex coding under Claude supervision
- Read Codex's `docs/ai/state.md` + diff → produce `docs/ai/review.md` via `/review-codex`
- Do not edit source files unless user says "Claude implementation mode"

**Codex's role:** see `AGENTS.md`

**Shared bridge files** (all tracked, not session scratch):
- `docs/ai/task.md`: brief
- `docs/ai/architecture.md`: Claude's plan
- `docs/ai/state.md`: Codex's implementation state
- `docs/ai/review.md`: Claude's findings

If both agents need to work simultaneously, the second agent uses a git worktree. One writer per checkout.
