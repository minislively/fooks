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

### Task B — ApplicationPacket save-flow edit
- Repo: `ai-job-finder`
- Target file: `components/ApplicationPacket.tsx`
- Task type: medium-complexity form/state edit
- Requested change:
  - show a live character count for personal notes
  - disable `Save Packet` until the cover letter contains non-whitespace content
- Initial mode: `hybrid`
- Decision reason:
  - `multiple-conditionals`
  - `event-heavy`
  - `style-branching`
  - `import-heavy`
  - `long-file`
- Confidence: `high`
- Linked context used: none (same-file state + save flow only)
- Fallback: none observed
- Build/test status:
  - `build`: passed (`next build`)
  - `lint`: passed with the same pre-existing warnings recorded in Task A
  - `test`: `not-tested` (repo has no dedicated test script)
- Reviewer outcome: success
- Current evidence:
  - model-facing payload retains contract/behavior/structure/snippets
  - edit touched both render-only UI (`notesCharacterCount`) and save gating (`canSave`) without widening scope
  - resulting diff remained local to `ApplicationPacket.tsx`
- Failure summary: none observed for this task
- Status: **successful Phase 2A validation task**

### Task C — linked-context candidate discovery (evidence gap)
- Scope searched:
  - `/Users/veluga/Documents/Workspace_Minseol/ai-job-finder`
  - `/Users/veluga/Documents/Workspace_Minseol/ai-subsidy-job-finder`
  - `/Users/veluga/Documents/Workspace_Minseol/portfolio`
- Search rule:
  - `.tsx/.jsx` importing same-folder `.ts` files that match the current allowlist (`.types/.props/.interface/.config/.util/.utils/.helper/.helpers` or `type`-only imports)
- Result:
  - no qualifying linked `.ts` edit candidate found in those active app repos
- Additional probe:
  - `/Users/veluga/Documents/Workspace_Minseol/hyperflow/packages/react/src/react.tsx` imports same-folder `./starter`
  - current `fxxks scan` does **not** index `starter.ts` as linked context because it is outside the current bounded allowlist
- Interpretation:
  - the bounded linked `.ts` policy remains conservative in practice
  - we do not yet have a successful real edit task that exercises linked `.ts` inclusion inside the current allowlist
  - the nearest concrete future case is a same-folder helper/config file, but widening beyond the allowlist still requires an explicit failure case
- Status: **open evidence gap; no scope widening justified yet**

## Immediate next step
Run 2–3 real edit tasks in `ai-job-finder` and log, for each:
1. requested change
2. chosen mode / reason / confidence
3. whether linked `.ts` was needed
4. whether fallback happened
5. edit outcome after reviewer check
6. build/lint result if relevant and fast
7. failure summary if any
