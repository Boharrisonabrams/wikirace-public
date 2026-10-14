---
description: Interview Bo to fill docs/ai/task.md: the durable brief that anchors the whole cycle
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(git log:*), Bash(ls:*)
argument-hint: "[one-line task description]"
---

You are filling `docs/ai/task.md`. This is the durable brief: every downstream stage (architect, implement, review) reads it. Vague task = bad plan = bad implementation.

## Do not edit source files in this mode.

## Step 1: Seed the task

If `$ARGUMENTS` was provided, use it as the seed goal. Otherwise ask Bo: "In one sentence, what are we trying to accomplish?"

## Step 2: Interview Bo

Fill the `docs/ai/task.md` template by asking just enough to get concrete, verifiable answers. Ask one question at a time. Skip sections Bo has already answered implicitly.

**Goal** (1 sentence)
- What's the one-sentence goal? Force conciseness: if it takes a paragraph, it's two tasks.

**Context** (2-4 sentences, or links)
- Why does this matter now? What triggered it?
- Link to prior investigations, issues, or wiki articles if they exist.

**Constraints**
- Hard deadlines?
- Backwards-compat or migration limits?
- Production safety limits? (Does this touch hosted data, deploys, or native release config?)
- Any "must use X" or "must not use Y" decisions already locked?

**Out of scope**
- What are we *explicitly not* doing? This prevents architect-scope-creep.

**Acceptance criteria**
- Push Bo to make these testable. "Returns X when Y" beats "works correctly."
- At least 2-3 concrete checks. For rules-engine or database changes, at least one must be an evidence criterion (a failing-then-passing test, a pgTAP assertion, or a hosted route check).

## Step 3: Write the file

Populate `docs/ai/task.md` with the interview answers. Keep prose tight: if a section is one bullet, that's fine.

## Step 4: Hand off

Print:

```
docs/ai/task.md is populated. Next: /architect

If this is an investigation-heavy task (why does X behave this way?),
Claude should invoke superpowers:systematic-debugging inside /architect.
```

## Anti-patterns

- **Don't let Bo write the whole thing solo**: the interview surfaces assumptions that would otherwise leak into `architecture.md` and go undetected.
- **Don't auto-continue into `/architect`**: Bo decides when to advance the cycle.
- **Don't fill acceptance criteria with "tests pass"**: name the specific behavior or metric.
- **Don't paper over "I don't know yet"**: capture it under `## Open Questions` in task.md (extend the template if needed). Questions visible in task.md get answered during architect; buried assumptions don't.
