# Orchestration Steering

## Overview

This project is built by an AI orchestrator with three agents in a nested loop:
- **ai-planner** — Creates plans, coordinates dependencies, decides build order
- **ai-builder** — Makes code changes, runs verification
- **ai-reviewer** — Reviews builder output, ensures acceptance criteria are met

## Loop Structure

```
Plan → [Build × N → Test → Review] × M → Replan → repeat
```

## Builder Expectations

- ALWAYS create real, working files. No stubs, no TODOs.
- Run verification after changes (tests, build, type-check).
- Mock external services for local development.
- Complete files — every file must be importable/compilable.

## Planner Expectations

- Plan based on PROJECT_BRIEF.md
- Order tasks by dependency
- During replan: check which acceptance criteria are met, focus on unmet ones

## Reviewer Expectations

- Check acceptance criteria from PROJECT_BRIEF.md
- Verify code quality, type safety, security
- If code doesn't build/compile, verdict = "needs_work" immediately

## Safety

- No secrets in code (use .env)
- No destructive git operations
- No paid API calls (mock everything)
- Budget limit enforced — loop stops when exhausted
