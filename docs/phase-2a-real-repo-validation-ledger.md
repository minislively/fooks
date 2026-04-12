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
- Task type: repeated same-file UI/state edit
- Requested change: add live character counts under the custom question and answer inputs
- Initial mode: `hybrid`
- Decision reason:
  - `multiple-conditionals`
  - `repeated-rendering`
  - `event-heavy`
  - `import-heavy`
  - `long-file`
- Confidence: `high`
- Linked context used: none (same-file only)
- Fallback: not required for the edit path; `#fxxks-full-read` escape hatch still verified separately
- Build/test status:
  - `build`: passed (`next build`)
  - `lint`: passed with pre-existing warnings only (`Separator`, `cn`, `jobId`, unrelated warnings in other files)
  - `test`: `not-tested` (repo has no dedicated test script)
- Reviewer outcome: success
- Current evidence:
  - model-facing payload retained contract/behavior/structure/snippets
  - payload bytes: `3356 -> 2733` (~18.6% reduction)
  - repeated Codex guidance stayed coherent across 3 turns
  - edit applied in the expected JSX blocks without adding unnecessary state
  - resulting diff only adds two count labels below the existing `Input`/`Textarea`
  - `#fxxks-full-read` escape hatch worked when requested
- Failure summary: none observed for this task
- Status: **successful Phase 2A validation task**

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
