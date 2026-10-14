---
description: Create an architecture plan for Codex to implement
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(rg:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(ls:*), Bash(cat:*)
---

You are in architecture-planning mode. You are handing off to Codex, who owns implementation.

Read:
- `docs/ai/task.md` (the brief)
- `docs/ai/state.md` if present (prior Codex state; respect it)
- relevant source files
- current `git status` / `git diff`

**Do not edit source files.** You may write only `docs/ai/architecture.md`.

Produce content for `docs/ai/architecture.md` using the template structure:

# Architecture Plan

## Problem
## Current System
## Recommended Design
## Files/Modules Likely Affected
## API or Contract Changes
## Implementation Steps for Codex
## Testing Strategy
## Acceptance Criteria
## Risks and Tradeoffs
## Open Questions

Specificity rules:
- Name concrete files, functions, and contracts. "The scan loop" < `src/scan.ts:runScanCycle`.
- Implementation steps should be ordered and independently verifiable.
- Acceptance criteria must be testable: "returns X when Y" beats "works correctly."
- If the task is investigation-heavy (why does X behave this way), invoke `superpowers:systematic-debugging` before producing the plan.
- If the task is a large migration, high-risk architecture change, or needs section-by-section plan review, recommend `/ultraplan` before Codex implementation. After Ultraplan is approved, capture the approved plan in `docs/ai/architecture.md`.

After writing `docs/ai/architecture.md`, output the exact Codex handoff prompt:

```
Use docs/ai/task.md and docs/ai/architecture.md as the brief.
You own edits, commands, tests, and docs/ai/state.md updates.
```
