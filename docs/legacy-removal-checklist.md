# Legacy Removal Checklist

This document defines the final gates before removing legacy compatibility
layers:

- legacy CLI alias: `fe-lens`
- legacy project state dir: `.fe-lens/`
- legacy env prefixes: `FE_LENS_*`

The current repo state is intentionally staged:

1. public name normalized to `fooks`
2. `.fooks` / `FOOKS_*` promoted to canonical internal names
3. user-facing warnings added for legacy `fe-lens` usage
4. `fooks migrate project-state` added as the project-local migration off-ramp

Do not remove legacy support before the checklist below is complete.

## Recommended removal order

### Stage A — announce

- keep runtime behavior unchanged
- document that `fe-lens`, `.fe-lens`, and `FE_LENS_*` are in compatibility-only mode
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

Completed: the deprecated `fxxks` alias and `#fxxks-*` escape hatches have already been removed.

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
- [ ] no required local automation still invokes `fe-lens`
- [ ] tests no longer need legacy behavior except dedicated historical/removal tests
- [ ] native/runtime integrations have been checked for canonical `fooks` commands only
- [ ] there is a deliberate version or release note that announces the breaking removal

## Suggested final removal patch shape

Keep the hard-removal diff narrow:

1. remove `fe-lens` CLI alias
2. remove `.fe-lens` fallback reads
3. remove `FE_LENS_*` fallback reads
4. update tests/docs to canonical names only

Do not combine unrelated refactors with the final removal patch.

## Remaining policy decision

The repo is now technically ready for a future breaking removal, but one
decision remains product/policy rather than implementation:

- **when** to cut the release that removes legacy names

Until that date/version is chosen, compatibility should stay in warning mode.
