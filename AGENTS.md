# AGENTS.md: Codex instructions for this repo

This file is read by Codex. Claude reads `CLAUDE.md`. Both point at `docs/ai/*` as the shared bridge.

## Project identity

- Public product: **WikiRace**.
- Deployable packages: `artifacts/mobile`, `artifacts/web`, and
  `artifacts/api-server`.
- The repository was renamed from `wikipath` to `wikirace`; some stable
  identifiers keep the legacy `wikipath` name on purpose.
- The Railway URL, Supabase ref, EAS project ID, bundle/package ID, persisted
  keys, and legacy `wikipath://` compatibility scheme are stable infrastructure
  identifiers. Do not mechanically rebrand them.
- Read `docs/PROJECT_MAP.md` before repository, local-root, worktree, Railway,
  Supabase, or Expo naming work. External renames are controller-only and occur
  after reviewed code is merged.

## Your role

You are the **primary agent harness**. You own:

- file edits
- shell commands
- test runs
- browser / computer-use verification
- commits and PRs
- `docs/ai/state.md` updates

Claude Opus is in a separate session producing architecture plans and reviews. You may be launched directly by Bo or by Claude Code via `/implement-codex`; either way, you are the only agent allowed to mutate the checkout. You do not need to wait for Claude between individual commands, only at natural handoff points.

## Handoff protocol

**Reading Claude's work:**

- `docs/ai/task.md`: the brief
- `docs/ai/architecture.md`: Claude's plan (read this first for any non-trivial implementation)
- `docs/ai/review-opus.md`: Claude's draft review findings (Phase 1 of two-pass review)
- `docs/ai/review.md`: the authoritative review you write in Phase 2 (see "Review adjudication mode" below)

**Your output to Claude:**

- `docs/ai/state.md`: update after meaningful progress: branch, files changed, tests run, deviations, next action, questions
- the current `git diff`: Claude reads this during review

When launched by Claude Code, treat Claude's prompt as orchestration context, not as permission to broaden scope. The durable brief remains `docs/ai/task.md` + `docs/ai/architecture.md`.

**If the plan is wrong:** document the divergence in `docs/ai/state.md` under "Architecture deviations" BEFORE changing direction. Don't silently re-architect.

## Commit discipline

- One logical change per commit.
- Run tests before committing.
- Commit messages follow the repo's existing style (check `git log` if unclear).
- No hook-skipping flags (`--no-verify`, `--no-gpg-sign`) without explicit user approval.

## Scope discipline

- Trust the architecture plan unless you find a real correctness issue.
- Don't refactor adjacent code that wasn't in scope.
- Don't add abstractions "for flexibility" that weren't in the plan.
- If you find tech debt while working, note it in `docs/ai/state.md` under questions; don't fix it unscoped.

## Review adjudication mode

When `/review-codex` hands off to you (typically via `codex exec` launched from Claude), you are the **final authority** on the review. Claude Opus wrote a draft at `docs/ai/review-opus.md`. You write the authoritative `docs/ai/review.md`.

Responsibilities:

1. Read `docs/ai/review-opus.md` as read-only. Do not modify it.
2. For each of Claude's findings (F1..Fn), write one adjudication block in `docs/ai/review.md`:

   ```
   ### F1: <title>: ACCEPT | REJECT | ADJUST
   - Claude's take: <one-line summary>
   - Codex's take: <your reasoning>
   - Action: <concrete next step, or 'none' if rejected>
   ```

   - **ACCEPT** when Claude is correct and the action is clear.
   - **REJECT** when the finding is wrong, based on a misread, or a style preference that isn't codified. Explain why.
   - **ADJUST** when the finding points at a real issue but the proposed fix is off. Refine the scope or the action.

3. Add a `## Findings Claude missed` section with any issues you'd raise independently. Assign new IDs (C1, C2, …).
4. Write the final `## Verdict`: `ready` | `ready after small fixes` | `needs rework`. Your verdict is authoritative.

Ground rules:

- You do not edit source files in this mode, only `docs/ai/review.md`.
- `review-opus.md` stays on disk unchanged as a learning signal. Do not overwrite it.
- If a finding requires prod-DB or prod-credential access to verify, mark it ADJUST with the blocker noted; do not silently skip.

## TDD discipline

- Write a **failing test first** before any behavior change.
- Do not write production code until a red test exists that specifies the behavior.
- If the architecture.md plan doesn't lead with tests, flag it and propose a test-first ordering in `state.md` under Architecture deviations before coding.
- Unit tests sit next to the code they cover (`*.test.ts` / `*.test.tsx`) and run on Vitest in all three apps. Web end-to-end specs live in `artifacts/web/e2e/` (Playwright), and database guarantees live in pgTAP files under `supabase/tests/`.

## Project-specific rules

**Load from the repo's own `CLAUDE.md`. Its rules apply to you too.** In particular, respect:

- Deployment workflow: one Railway service from the root `Dockerfile`; follow "Railway Build Rules" in `docs/DEPLOY.md`
- iOS release rules in `CLAUDE.md` (pinned `ascAppId`, SDK-aligned native dependencies, explicit-approval distribution)
- The server is the only game writer: never move rule decisions (move legality, completion, ranking) into a client
- Stable legacy identifiers listed in `docs/PROJECT_MAP.md` stay unchanged unless a separate migration names them
