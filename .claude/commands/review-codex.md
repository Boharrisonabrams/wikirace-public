---
description: Two-pass review: Claude Opus drafts findings; Codex adjudicates and writes the authoritative review.md
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(rg:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(ls:*), Bash(codex exec:*), Bash(codex --version:*)
---

You are Claude Opus running **Phase 1** of the two-pass review. Codex (GPT-5.5) runs Phase 2 and has **final authority**: Codex can accept, reject, or adjust each of your findings and add new ones you missed.

## Phase 1: Claude drafts `docs/ai/review-opus.md`

Read:
- `docs/ai/task.md`
- `docs/ai/architecture.md`
- `docs/ai/state.md`
- `AGENTS.md` (especially the **Review adjudication mode** section)
- current `git diff` (both staged and unstaged)
- relevant source files referenced in the diff

**Do not edit source files. Do not write `docs/ai/review.md`: that's Codex's output.** You write only `docs/ai/review-opus.md`.

Produce `docs/ai/review-opus.md` using this structure:

```
# Codex Implementation Review: Claude Opus draft

<!-- Phase 1 of two-pass review. Codex adjudicates in review.md. -->

## Findings
<!-- Real issues only. One block per finding:
  ### F1: <short title>
  - File: path:line
  - Severity: high | medium | low
  - Why: <reasoning>
-->

## Architecture Drift
<!-- Places where implementation diverges from architecture.md. -->

## Missing Tests
<!-- Important untested behavior. -->

## Recommended Fixes
<!-- Each fix: file, function, concrete change. -->
```

Do NOT write a Verdict section; the final verdict lives in `review.md` and is Codex's call.

Rules for findings:
- Only flag **real** issues. No nitpicks, no uncodified style preferences, no speculative risks.
- Every finding must cite file + line/function and explain **why**.
- Use stable IDs (F1, F2, …) so Codex can reference them in its adjudication.
- Invoke `superpowers:verification-before-completion` before handing off.
- For high-stakes findings (architectural, data-integrity, contract-breaking), invoke `feature-dev:code-reviewer` as a second Claude-side pass before writing.

## Phase 2: hand off to Codex

After writing `review-opus.md`, shell out to Codex to produce the authoritative `docs/ai/review.md`. Use a command shaped like:

```bash
codex exec \
  -m gpt-5.5 \
  --config model_reasoning_effort="high" \
  --sandbox workspace-write \
  --skip-git-repo-check \
  "You are adjudicating Claude Opus's draft review.

Inputs:
- docs/ai/review-opus.md (READ-ONLY; do not modify)
- docs/ai/task.md, docs/ai/architecture.md, docs/ai/state.md
- current git diff
- AGENTS.md (see the 'Review adjudication mode' section; that is authoritative)

Your output: docs/ai/review.md.

For each finding F1..Fn in review-opus.md, write an adjudication block:
  ### F1: <title>: ACCEPT | REJECT | ADJUST
  - Claude's take: <one-line summary>
  - Codex's take: <your reasoning>
  - Action: <what Codex or Bo should do, or 'none' if rejected>

Then add a '## Findings Claude missed' section with any issues you'd raise independently, using the same block structure (assign new IDs C1, C2, …).

Then write the final '## Verdict': ready | ready after small fixes | needs rework. Your verdict is authoritative.

Do not modify docs/ai/review-opus.md. Do not edit source files.
If network, production credentials, or destructive operations are needed, stop and report instead."
```

If `gpt-5.5` is unavailable, fall back to `gpt-5.2` and note the fallback in your summary.

## After Codex returns

1. Read `docs/ai/review.md` (Codex's authoritative output).
2. Summarize the verdict + adjudication stats (n accepted / rejected / adjusted + n Codex-only findings).
3. Emit the next-step prompt Bo should run:
   - If verdict = `ready` → suggest `/duet` (will route to ship).
   - If verdict = `ready after small fixes` or `needs rework` → suggest `/implement-codex` with `docs/ai/review.md` as the primary input.

## Files on disk after both phases

- `docs/ai/review-opus.md`: Claude's draft, preserved for transparency + learning signal.
- `docs/ai/review.md`: Codex's authoritative adjudication + verdict.

Do not overwrite `review-opus.md` after Phase 1. Its value is as a training signal for where each model is weak.
