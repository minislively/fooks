# fxxks

Repository name: `fxxks`  
Phase 1 engine codename: `fe-lens`

Local frontend-only context compression engine for React/TSX files.

## What it does

`fe-lens` reduces AI read cost before a coding runtime opens full frontend source by returning one of:

- `raw`
- `compressed`
- `hybrid`

Phase 1 is intentionally narrow:

- React / TSX / JSX focused
- directly linked `.ts` types, props, and component-scoped utils only
- local scan / extract / decide / attach flow
- runtime-agnostic core schema with thin adapters

## Commands

```bash
fe-lens init
fe-lens scan
fe-lens extract <file> --json
fe-lens decide <file>
fe-lens attach codex
fe-lens attach claude
```

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

## Notes

- Core logic stays adapter-agnostic.
- Runtime attach remains environment-dependent by design, but now fails honestly with blocker evidence.
