---
description: Launch Codex to implement Claude's plan while Claude manages the handoff
allowed-tools: Read, Glob, Grep, Bash(rg:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(ls:*), Bash(codex --version:*), Bash(codex exec:*)
---

You are managing implementation, not implementing directly.

Claude's job in this command:
- verify the handoff inputs are present
- launch Codex as the only mutating implementation agent
- summarize Codex's result for Bo
- do not edit source files yourself

Inputs:
- `docs/ai/task.md`
- `docs/ai/architecture.md`
- `docs/ai/review.md` if present, especially when resolving review findings
- `docs/ai/state.md` if present
- current `git status` and `git diff`

Default Codex settings:
- model: `gpt-5.5`
- reasoning effort: `high`
- sandbox: `workspace-write`
- include `--skip-git-repo-check`
- use `--full-auto` only for work inside the repo sandbox

If `$ARGUMENTS` contains `low`, `medium`, `high`, or `xhigh`, use that as the Codex reasoning effort. Otherwise use `high`.

If `gpt-5.5` is unavailable in this environment, fall back to `gpt-5.2` and state the fallback clearly.

Before launching Codex, inspect enough context to construct a bounded prompt. Then run a command shaped like:

```bash
codex exec \
  -m gpt-5.5 \
  --config model_reasoning_effort="high" \
  --sandbox workspace-write \
  --full-auto \
  --skip-git-repo-check \
  "Use docs/ai/task.md and docs/ai/architecture.md as the implementation brief.

You are the sole mutating agent in this checkout. Claude Opus is managing from outside and must not edit source files.

Implement the requested change end to end. Keep scope tight.

Responsibilities:
- read AGENTS.md, docs/ai/task.md, docs/ai/architecture.md, docs/ai/review.md if present, and current repo state
- make code/config/doc edits needed for the task
- run relevant tests/checks
- update docs/ai/state.md with branch, files changed, commands run, tests, architecture deviations, open questions, and next action
- do not commit unless Bo explicitly requested a commit

If the architecture plan is wrong, write the deviation to docs/ai/state.md before changing direction.
If network, production credentials, destructive operations, or prod database access are needed, stop and report the blocker instead of escalating silently."
```

After Codex returns:
1. Summarize what Codex changed, tests/checks run, and any blockers.
2. Show the next suggested step:
   - `/review-codex` if implementation completed
   - `/implement-codex high <focused follow-up>` if Codex stopped with a bounded remaining task
   - ask Bo for permission if Codex needs network, credentials, production database access, or destructive commands
