# Phase 2A — Real Repo Validation Ledger

Updated: 2026-04-12 (Asia/Seoul)
Repo under validation: `/Users/veluga/Documents/Workspace_Minseol/ai-job-finder`
Validation harness repo: `/Users/veluga/Documents/Workspace_Minseol/fxxks`
Current `fxxks` commit at capture time: `8f54360`

## Sign-off rule
- Base success: edit quality + reviewer confirmation
- Add build/test if fast and relevant
- If build/test is absent or too heavy for the task, record `not-tested`
- Reliability beats compression: if compressed/hybrid harms edit quality, tighten rules even if token savings drop

## Repo capability snapshot
- TSX/JSX files discovered: 33
- Available scripts:
  - `build`: `next build`
  - `lint`: `eslint`
- No dedicated `test` script detected

## Candidate validation tasks

### Task A — QuestionAnswerForm same-file repeated edit loop
- Repo: `ai-job-finder`
- Target file: `components/QuestionAnswerForm.tsx`
- Task type: repeated same-file UI/state edit guidance
- Initial mode: `hybrid`
- Decision reason:
  - `multiple-conditionals`
  - `repeated-rendering`
  - `event-heavy`
  - `import-heavy`
  - `long-file`
- Confidence: `high`
- Linked context used: none (same-file only)
- Fallback: not required for normal turns; escape hatch verified separately
- Build/test status: `not-tested` (no fast task-specific test script; full build not run against an edit yet)
- Reviewer outcome: partial evidence only
- Current evidence:
  - model-facing payload retained contract/behavior/structure/snippets
  - payload bytes: `3356 -> 2733` (~18.6% reduction)
  - repeated Codex guidance stayed coherent across 3 turns
  - `#fxxks-full-read` escape hatch worked
- Status: **needs a real code edit + review outcome to count as a full Phase 2A task**

### Task B — ApplicationPacket edit candidate
- Repo: `ai-job-finder`
- Target file: `components/ApplicationPacket.tsx`
- Task type: medium-complexity form/state edit candidate
- Initial mode: `hybrid`
- Decision reason:
  - `multiple-conditionals`
  - `event-heavy`
  - `style-branching`
  - `import-heavy`
  - `long-file`
- Confidence: `high`
- Linked context used: none yet
- Fallback: none observed yet
- Build/test status: `not-tested`
- Reviewer outcome: not started
- Current evidence:
  - model-facing payload retains contract/behavior/structure/snippets
  - candidate is suitable for a next real edit task because it includes state, conditionals, and save flow
- Status: **queued**

## Immediate next step
Run 2–3 real edit tasks in `ai-job-finder` and log, for each:
1. requested change
2. chosen mode / reason / confidence
3. whether linked `.ts` was needed
4. whether fallback happened
5. edit outcome after reviewer check
6. build/lint result if relevant and fast
7. failure summary if any
