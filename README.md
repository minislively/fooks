# fooks

Product / package / primary CLI name: `fooks`
Compatibility aliases: deprecated `fxxks`, legacy `fe-lens`

Local frontend-only context compression engine for React/TSX files.

## What it does

`fooks` reduces AI read cost before a coding runtime opens full frontend source by returning one of:

- `raw`
- `compressed`
- `hybrid`

Phase 1 is intentionally narrow:

- React / TSX / JSX focused
- same-folder linked `.ts` only (`type` imports, props/interface/type aliases, adjacent util/helper files)
- local scan / extract / decide / attach flow
- runtime-agnostic core schema with thin adapters

## Commands

```bash
fooks init
fooks scan
fooks migrate project-state
fooks extract <file> --json
fooks extract <file> --model-payload
fooks decide <file>
fooks codex-pre-read <file>
fooks codex-runtime-hook --event <SessionStart|UserPromptSubmit|Stop>
fooks codex-runtime-hook --native-hook
fooks install codex-hooks
fooks status codex
fooks attach codex
fooks attach claude
```

Early Phase 1 drafts may still refer to `fe-lens`. The shipping product name is `fooks`; `fxxks` is now a deprecated compatibility CLI alias, while `fe-lens` remains for older internal path/env contracts.

## Account context

Attach commands resolve account context in this order:

1. `FOOKS_ACTIVE_ACCOUNT` (fallback: `FE_LENS_ACTIVE_ACCOUNT`)
2. `.fooks/config.json` `targetAccount` (fallback: `.fe-lens/config.json`)
3. `git remote get-url origin`
4. `package.json.repository`

For this project, the expected target account is `minislively`.

## Runtime proof

Attach uses two proof layers:

- **contract proof**: verifies adapter consumption of the core schema
- **runtime proof**: writes a runtime manifest into a detected runtime home

Environment overrides for deterministic verification:

- `FOOKS_CODEX_HOME` (fallback: `FE_LENS_CODEX_HOME`)
- `FOOKS_CLAUDE_HOME` (fallback: `FE_LENS_CLAUDE_HOME`)
- `FOOKS_TARGET_ACCOUNT` (fallback: `FE_LENS_TARGET_ACCOUNT`)
- `FOOKS_ACTIVE_ACCOUNT` (fallback: `FE_LENS_ACTIVE_ACCOUNT`)

If a runtime home is missing, attach returns an explicit blocker instead of a false success.

## Verification snapshot

Current Phase 1 verification:

- `npm run typecheck`
- `npm test`
- `npm run bench:cache`
- TypeScript diagnostics: 0 errors
- value-proof:
  - `FormSection.tsx`: 36.02% reduction
  - `DashboardPanel.tsx`: 45.1% reduction

## Model-facing payload

`extract` keeps the canonical extraction output by default. For a leaner LLM-delivery view:

```bash
fooks extract fixtures/compressed/FormSection.tsx --model-payload
```

The model-facing payload:

- keeps `mode`, relative `filePath`, `componentName`, `exports`
- keeps `contract`, `behavior`, `structure`, minimal `style`
- keeps `snippets` for hybrid outputs
- drops engine metadata such as `fileHash` and `meta.generatedAt`

## Codex pre-read decision seam

The first Codex-specific pre-read seam is exposed as a debug surface:

```bash
fooks codex-pre-read fixtures/compressed/FormSection.tsx
```

It is intentionally narrow in v1:

- `.tsx/.jsx` only
- payload-first, never payload-only
- falls back to `full-read` for:
  - `raw-mode`
  - `missing-contract`
  - `missing-behavior`
  - `missing-structure`
  - `missing-hybrid-snippets`
  - `ineligible-extension`

This command proves the decision/debug seam that a future automatic Codex hook can reuse. It is **not** the full runtime-wide interception layer yet.

## Codex runtime hook bridge

`fooks` now exposes a first runtime-hook bridge that is grounded in the Codex hook surfaces we can actually verify locally today:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The v1 bridge is intentionally narrow:

- `.tsx/.jsx` only
- repeated same-file work in one session
- quiet by default
- full-read escape hatch via `#fooks-full-read` or `#fooks-disable-pre-read`
- only active inside repos that already ran `fooks attach codex`

Example debug flow:

```bash
fooks codex-runtime-hook --event SessionStart --session-id demo
fooks codex-runtime-hook --event UserPromptSubmit --session-id demo --prompt "Please update fixtures/compressed/FormSection.tsx"
fooks codex-runtime-hook --event UserPromptSubmit --session-id demo --prompt "Again, update fixtures/compressed/FormSection.tsx"
```

Expected behavior:

- first prompt mention records the file quietly
- second prompt mention can reuse `fooks` pre-read payload and emits a one-line header like `fooks: reused pre-read (<mode>) · file: <path>`
- override markers force immediate full-read fallback and emit `fooks: full read requested · file: <path> · Read the full source file for this turn.`
- readiness fallback emits `fooks: fallback (<reason>) · file: <path> · Read the full source file for this turn.`

This is a **prompt/session bridge**, not a claim that Codex already exposes a universal low-level file-read hook.

For Codex native hook wiring, the repo-side bridge can also read the hook payload from stdin:

```bash
fooks codex-runtime-hook --native-hook
```

Preferred install path (writes or merges the Codex hook preset into `~/.codex/hooks.json`):

```bash
fooks install codex-hooks
```

The installer is idempotent: it only adds the `fooks codex-runtime-hook --native-hook` command to `SessionStart`, `UserPromptSubmit`, and `Stop` when those entries are missing, and preserves other hooks already present in `~/.codex/hooks.json`.

For a lightweight trust/debug surface after attach, inspect the Codex runtime status:

```bash
fooks status codex
```

This keeps the product UX quiet by default while still exposing the minimum trust signals we care about in Phase 2B:

- connection state
- lifecycle state (`ready`, `refreshing`, `attach-prepared`, ...)
- last scan / refresh timestamps
- current active file when an attach package was prepared

For a real-world feedback loop after installation, use the checklist in [`docs/codex-live-feedback-checklist.md`](docs/codex-live-feedback-checklist.md).

For the next Phase 2B step — validating remaining trust/refresh/source-of-truth risks in real usage — use [`docs/phase-2b-risk-validation-checklist.md`](docs/phase-2b-risk-validation-checklist.md).

If you prefer to edit the file manually, add this preset:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "fooks codex-runtime-hook --native-hook"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "fooks codex-runtime-hook --native-hook"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "fooks codex-runtime-hook --native-hook"
          }
        ]
      }
    ]
  }
}
```

When the current cwd is not a Codex-attached `fooks` project, the native hook bridge exits quietly without output.

## Cache validation

You can validate cache correctness and warm-cache performance with:

```bash
npm test
npm run bench:cache
```

The benchmark reports:

- cold scan time
- warm scan time
- partial invalidation time
- refreshed vs reused cache entries
- cache hit ratio

## Real repo testing

After fixture-level verification, validate against an actual React/TSX
repo using:

- cold/warm/partial scan behavior
- representative `decide` checks
- canonical `extract` vs `extract --model-payload`
- one real edit task against compressed/hybrid outputs

See `docs/real-repo-validation.md`.

## Notes

- Core logic stays adapter-agnostic.
- Runtime attach remains environment-dependent by design, but now fails honestly with blocker evidence.


Legacy compatibility:

- `fxxks` still works as a deprecated CLI alias; prefer `fooks`
- `fe-lens` still works as a legacy CLI alias for older internal contracts
- `#fxxks-full-read` and `#fxxks-disable-pre-read` still work as deprecated escape hatches
- canonical internal paths now use `.fooks/` and runtime-home `fooks/attachments`
- legacy `.fe-lens/` paths and `FE_LENS_*` env names remain compatibility fallbacks during migration
- direct CLI usage now emits stderr warnings when it falls back to legacy `FE_LENS_*` env names or `.fe-lens/`-only project state
- `fooks migrate project-state` can move or merge project-local legacy `.fe-lens/` state into canonical `.fooks/`
- final breaking-removal gates are tracked in [`docs/legacy-removal-checklist.md`](docs/legacy-removal-checklist.md)
