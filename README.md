# fxxks

Product / repo / package / primary CLI name: `fxxks`  
Legacy Phase 1 alias: `fe-lens`

Local frontend-only context compression engine for React/TSX files.

## What it does

`fxxks` reduces AI read cost before a coding runtime opens full frontend source by returning one of:

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
fxxks init
fxxks scan
fxxks extract <file> --json
fxxks extract <file> --model-payload
fxxks decide <file>
fxxks codex-pre-read <file>
fxxks codex-runtime-hook --event <SessionStart|UserPromptSubmit|Stop>
fxxks codex-runtime-hook --native-hook
fxxks attach codex
fxxks attach claude
```

Early Phase 1 drafts may still refer to `fe-lens`. The shipping product name is `fxxks`, while `fe-lens` remains as a compatibility CLI alias and for existing internal path/env contracts.

## Account context

Attach commands resolve account context in this order:

1. `FE_LENS_ACTIVE_ACCOUNT`
2. `.fe-lens/config.json` `targetAccount`
3. `git remote get-url origin`
4. `package.json.repository`

For this project, the expected target account is `minislively`.

## Runtime proof

Attach uses two proof layers:

- **contract proof**: verifies adapter consumption of the core schema
- **runtime proof**: writes a runtime manifest into a detected runtime home

Environment overrides for deterministic verification:

- `FE_LENS_CODEX_HOME`
- `FE_LENS_CLAUDE_HOME`
- `FE_LENS_TARGET_ACCOUNT`
- `FE_LENS_ACTIVE_ACCOUNT`

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
fxxks extract fixtures/compressed/FormSection.tsx --model-payload
```

The model-facing payload:

- keeps `mode`, relative `filePath`, `componentName`, `exports`
- keeps `contract`, `behavior`, `structure`, minimal `style`
- keeps `snippets` for hybrid outputs
- drops engine metadata such as `fileHash` and `meta.generatedAt`

## Codex pre-read decision seam

The first Codex-specific pre-read seam is exposed as a debug surface:

```bash
fxxks codex-pre-read fixtures/compressed/FormSection.tsx
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

`fxxks` now exposes a first runtime-hook bridge that is grounded in the Codex hook surfaces we can actually verify locally today:

- `SessionStart`
- `UserPromptSubmit`
- `Stop`

The v1 bridge is intentionally narrow:

- `.tsx/.jsx` only
- repeated same-file work in one session
- quiet by default
- full-read escape hatch via `#fxxks-full-read` or `#fxxks-disable-pre-read`
- only active inside repos that already ran `fxxks attach codex`

Example debug flow:

```bash
fxxks codex-runtime-hook --event SessionStart --session-id demo
fxxks codex-runtime-hook --event UserPromptSubmit --session-id demo --prompt "Please update fixtures/compressed/FormSection.tsx"
fxxks codex-runtime-hook --event UserPromptSubmit --session-id demo --prompt "Again, update fixtures/compressed/FormSection.tsx"
```

Expected behavior:

- first prompt mention records the file quietly
- second prompt mention can reuse `fxxks` pre-read payload and emits a one-line header like `fxxks: reused pre-read (<mode>) · file: <path>`
- override markers force immediate full-read fallback and emit `fxxks: full read requested · file: <path> · Read the full source file for this turn.`
- readiness fallback emits `fxxks: fallback (<reason>) · file: <path> · Read the full source file for this turn.`

This is a **prompt/session bridge**, not a claim that Codex already exposes a universal low-level file-read hook.

For Codex native hook wiring, the repo-side bridge can also read the hook payload from stdin:

```bash
fxxks codex-runtime-hook --native-hook
```

Recommended `~/.codex/hooks.json` addition:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "fxxks codex-runtime-hook --native-hook"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "fxxks codex-runtime-hook --native-hook"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "fxxks codex-runtime-hook --native-hook"
          }
        ]
      }
    ]
  }
}
```

When the current cwd is not a Codex-attached `fxxks` project, the native hook bridge exits quietly without output.

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
