# Phase 2A — Real Repo Validation Ledger

Updated: 2026-04-13 (Asia/Seoul)
Repos under validation:
- `/Users/veluga/Documents/Workspace_Minseol/ai-job-finder`
- `/Users/veluga/Documents/Workspace_Minseol/hyperflow`
Validation harness repo: `/Users/veluga/Documents/Workspace_Minseol/fxxks`
Current `fxxks` commit at capture time: `61c6919`

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

### Task C — CompareNodeChrome linked type-only context edit
- Repo: `hyperflow`
- Target file: `apps/site/src/compare/CompareNodeChrome.tsx`
- Linked context: `apps/site/src/compare/types.ts` (`import type { CompareNodeData } from "./types.ts";`)
- Task type: same-file UI copy polish that depends on bounded linked type context
- Requested change: replace raw `data.kind` tokens with human-friendly labels (`Input node`, `Transform node`, `Output node`) without weakening type safety
- Initial mode: `hybrid`
- Decision reason:
  - `shallow-jsx`
  - `multiple-conditionals`
  - `style-branching`
- Confidence: `medium`
- Linked context used: yes — same-folder `type`-only import from `types.ts`
- Fallback: none observed
- Build/test status:
  - `build`: passed (`pnpm build` in `apps/site`)
  - `lint`: `not-tested` (no app-local fast lint script; workspace lint/check is substantially broader)
  - `test`: `not-tested` (no task-specific fast test selected)
- Reviewer outcome: success
- Current evidence:
  - `fxxks scan` indexed both `apps/site/src/compare/CompareNodeChrome.tsx` and qualifying linked-ts `apps/site/src/compare/types.ts`
  - edit stayed local to `CompareNodeChrome.tsx` while using `Record<CompareNodeData["kind"], string>` for type-safe label coverage
  - payload bytes: `2268 -> 1687` (~25.6% reduction)
  - resulting diff only replaces the raw union token with a bounded label map
- Failure summary: none observed for this task
- Status: **successful Phase 2A linked-context validation task**

### Task D — SearchBar low-confidence same-file edit
- Repo: `ai-job-finder`
- Target file: `components/SearchBar.tsx`
- Task type: low-confidence same-file UX polish
- Requested change: add a live character count below the search input without changing the debounce/search behavior
- Initial mode: `hybrid`
- Decision reason:
  - `shallow-jsx`
  - `heavy-hook-usage`
- Confidence: `low`
- Linked context used: none
- Fallback: none observed
- Build/test status:
  - `build`: passed (`next build`)
  - `lint`: passed with the same pre-existing warnings recorded in Task A
  - `test`: `not-tested` (repo has no dedicated test script)
- Reviewer outcome: success
- Current evidence:
  - payload bytes: `1585 -> 1031` (~34.9% reduction)
  - edit stayed local to `SearchBar.tsx` and preserved the debounced `onSearch` effect wiring
  - low confidence did **not** force a fallback here; the task still completed cleanly as a bounded same-file edit
- Failure summary: none observed for this task
- Status: **successful low-confidence Phase 2A validation task**

### Task E — linked-context candidate discovery follow-up
- Scope searched:
  - `/Users/veluga/Documents/Workspace_Minseol/ai-job-finder`
  - `/Users/veluga/Documents/Workspace_Minseol/ai-subsidy-job-finder`
  - `/Users/veluga/Documents/Workspace_Minseol/portfolio`
  - `/Users/veluga/Documents/Workspace_Minseol/hyperflow`
- Search rule:
  - `.tsx/.jsx` importing same-folder `.ts` files that match the current allowlist (`.types/.props/.interface/.config/.util/.utils/.helper/.helpers` or `type`-only imports)
- Result:
  - qualifying linked `.ts` candidates remain sparse in the active app repos
- Additional probe:
  - `/Users/veluga/Documents/Workspace_Minseol/hyperflow/packages/react/src/react.tsx` imports same-folder `./starter`
  - current `fxxks scan` does **not** index `starter.ts` as linked context because it is outside the current bounded allowlist
- Interpretation:
  - the bounded linked `.ts` policy remains conservative in practice
  - we now have one successful allowlist-compliant linked-context task (`CompareNodeChrome.tsx` + `types.ts`)
  - broader scope widening is still not justified without an explicit real failure case
- Status: **bounded linked-context evidence established; broader scope still intentionally closed**

## Immediate next step
Continue real-repo validation with an emphasis on the remaining evidence gaps:
1. at least one late-fallback or explicit failure case
2. any task where `compressed` or `hybrid` should have been `raw`
3. any repo/task that would justify widening the bounded linked `.ts` allowlist beyond the current same-folder policy
4. build/lint/test results when they are fast and relevant
