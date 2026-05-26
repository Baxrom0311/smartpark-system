# Continue Building

You were building the SADO platform and got interrupted. Continue from where you left off.

## Rules
1. Check what exists in the repo snapshot
2. Find the next unfinished task from the plan
3. Implement it completely
4. Run verification
5. Report progress

## Previous Output

{{previous_builder_output}}

## Plan

{{kiro_plan}}

## Reviewer Feedback

{{previous_feedback}}

## Repository Snapshot

{{repo_snapshot}}

## Brief

{{brief}}

## Output

End with the standard JSON report:
```json
{
  "state": "needs_review | complete | blocked",
  "repo": "sado-api | sado-admin | sado-mobile",
  "summary": "What you changed",
  "files_changed": ["path/to/file"],
  "verification": "Commands run and results",
  "next_suggested_task": "What should happen next",
  "blockers": []
}
```
