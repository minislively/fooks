# Legacy Removal Checklist

This document defines the final gates before removing legacy compatibility
layers:

- deprecated CLI alias: `fxxks`
- legacy CLI alias: `fe-lens`
- legacy project state dir: `.fe-lens/`
- legacy env prefixes: `FE_LENS_*`
- deprecated escape hatches: `#fxxks-full-read`, `#fxxks-disable-pre-read`

The current repo state is intentionally staged:

1. public name normalized to `fooks`
2. `fxxks` downgraded to deprecated compatibility alias
3. `.fooks` / `FOOKS_*` promoted to canonical internal names
4. user-facing warnings added for legacy `fe-lens` usage
5. `fooks migrate project-state` added as the project-local migration off-ramp

Do not remove legacy support before the checklist below is complete.

## Recommended removal order

### Stage A — announce

- keep runtime behavior unchanged
- document that `fxxks`, `fe-lens`, `.fe-lens`, and `FE_LENS_*` are in
  compatibility-only mode
- point users to `fooks migrate project-state`

### Stage B — migrate active users

- run `fooks migrate project-state` in active repos that still have
  `.fe-lens/`
- update local scripts, shell aliases, and CI to use:
  - `fooks`
  - `.fooks/`
  - `FOOKS_*`
- confirm no important workflow still depends on `fe-lens` naming

### Stage C — remove deprecated public aliases first

Remove these before touching internal storage compatibility:

- `fxxks` CLI alias
- `#fxxks-full-read`
- `#fxxks-disable-pre-read`
- `fxxks` wording in tests/docs except historical changelog references

### Stage D — remove legacy internal compatibility

Only after the migration window is complete:

- stop reading `.fe-lens/`
- stop reading `FE_LENS_*`
- stop recognizing `fe-lens` as a CLI alias
- remove warning-only compatibility branches

## Remove-ready checklist

Mark each item complete before removal:

- [ ] README and migration docs clearly point to `fooks migrate project-state`
- [ ] all active project-local state has been migrated from `.fe-lens/` to `.fooks/`
- [ ] no required local automation still uses `FE_LENS_*`
- [ ] no required local automation still invokes `fxxks` or `fe-lens`
- [ ] tests no longer need legacy behavior except dedicated historical/removal tests
- [ ] native/runtime integrations have been checked for canonical `fooks` commands only
- [ ] there is a deliberate version or release note that announces the breaking removal

## Suggested final removal patch shape

Keep the hard-removal diff narrow:

1. remove `fxxks` and `fe-lens` CLI aliases
2. remove legacy escape hatch tokens
3. remove `.fe-lens` fallback reads
4. remove `FE_LENS_*` fallback reads
5. update tests/docs to canonical names only

Do not combine unrelated refactors with the final removal patch.

## Remaining policy decision

The repo is now technically ready for a future breaking removal, but one
decision remains product/policy rather than implementation:

- **when** to cut the release that removes legacy names

Until that date/version is chosen, compatibility should stay in warning mode.
