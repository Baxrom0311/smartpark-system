# SADO Platform — Orchestration Steering

## Project Overview

SADO is an AI-powered speech therapy platform for children in Uzbekistan. It consists of 3 independent repositories built in parallel by the orchestrator.

## Architecture

Three separate Kiro agents in a nested loop:
- **ai-planner** (Opus): Creates plans for all 3 repos, coordinates dependencies, decides build order
- **ai-builder** (Opus): Makes code changes in one repo at a time, runs verification
- **ai-reviewer** (Opus): Reviews builder output, ensures acceptance criteria are met

## Three-Repo Strategy

The builder must work on repos in this priority order:

### Phase 1: Foundation (builds 1-50)
1. **sado-api** — Set up FastAPI project, database models, auth, core CRUD endpoints
2. **sado-admin** — Set up Vite+React project, routing, auth, layout shell
3. **sado-mobile** — Set up Expo project, navigation, auth, basic screens

### Phase 2: Core Features (builds 51-100)
1. **sado-api** — Audio upload, Celery workers, ML scoring mock, all endpoints complete
2. **sado-admin** — Dashboard, data tables, forms, charts, all CRUD pages
3. **sado-mobile** — Assessment game flow, audio recording, results, exercises

### Phase 3: Polish (builds 101-150)
1. **sado-api** — Tests, error handling, Docker Compose, health checks
2. **sado-admin** — i18n, dark mode, responsive, loading states, tests
3. **sado-mobile** — Offline mode, animations, push notifications, tests

## Git Strategy

Each repo is created with `gh repo create --public`:
```bash
gh repo create sado-api --public --source=./sado-api --push
gh repo create sado-admin --public --source=./sado-admin --push
gh repo create sado-mobile --public --source=./sado-mobile --push
```

After each successful build, commit and push to the respective repo.

## Loop Structure

```
Plan → [Build × 8 → Test → Review] × 3 → Replan → repeat (5 cycles)
```

Total capacity: 5 × 3 × 8 = 120 builds minimum, up to 150 max.

## Builder Expectations

- **ALWAYS create real, working files.** No stubs, no TODOs, no "implement later" comments.
- **One repo per build iteration.** Don't mix sado-api and sado-admin changes.
- **Run verification after changes:**
  - sado-api: `cd sado-api && python -m pytest -q`
  - sado-admin: `cd sado-admin && npm run build`
  - sado-mobile: `cd sado-mobile && npx tsc --noEmit`
- **Create GitHub repos early** (first build iteration for each sub-project).
- **Mock external services** — Whisper returns fake transcription, ML model returns random risk scores.
- **Complete files** — Every file must be importable/compilable. No syntax errors.

## Planner Expectations

- Plan all 3 repos together, noting dependencies (admin needs API endpoints to exist first)
- Assign clear milestones per repo
- During replan: check which acceptance criteria are met, focus on unmet ones
- Coordinate: if admin needs `/api/v1/children` endpoint, ensure API builds it first

## Reviewer Expectations

- Check acceptance criteria from PROJECT_BRIEF.md
- Verify TypeScript strict mode (no `any`)
- Verify all endpoints have proper auth guards
- Verify i18n strings are externalized
- Verify offline support in mobile
- If a repo doesn't build/compile, verdict = "needs_work" immediately

## Safety

- No secrets in code (use .env.example)
- No destructive git operations
- No paid API calls (mock everything)
- Budget limit enforced — loop stops when exhausted
- Each repo independently deployable
