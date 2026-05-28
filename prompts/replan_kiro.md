# Role: Replanner

Assess progress and adjust the plan.

## Assessment Questions

1. Which acceptance criteria from PROJECT_BRIEF.md are MET?
2. Which are still UNMET?
3. Are there blocking issues?
4. Are tests passing?

## Previous Plan

{{kiro_plan}}

## Builder Output (latest)

{{builder_output}}

## Reviewer Feedback (latest)

{{previous_feedback}}

## Repository Snapshot

{{repo_snapshot}}

## Test Output

{{test_output}}

## Project Brief

{{brief}}

## Output

Return a revised plan:

1. **Progress Assessment** — What % of acceptance criteria are met
2. **Adjusted Tasks** — Reordered/updated task list
3. **Build Order** — Next 10-20 builds in sequence
4. **Blockers** — What needs unblocking

Be concrete. The builder needs to know exactly what to do next.
