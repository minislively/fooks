# Legacy Removal Checklist

This document records the completed removal of legacy compatibility layers:

- legacy CLI alias: `fe-lens`
- legacy project state dir: `.fe-lens/`
- legacy env prefixes: `FE_LENS_*`

The repo now supports only canonical `fooks` naming for CLI, project state, and environment variables.

## Removal summary

Completed removal steps:

1. removed the deprecated `fxxks` CLI alias and `#fxxks-*` escape hatches
2. removed the `fe-lens` CLI alias
3. removed `.fe-lens/` fallback reads
4. removed `FE_LENS_*` fallback reads
5. updated tests/docs to canonical `fooks` names only

## Post-removal rule

Keep future changes aligned to canonical names only:

- CLI / package / hook command: `fooks`
- project state dir: `.fooks/`
- env names: `FOOKS_*`

Treat any remaining `fe-lens` mention as historical documentation, not supported behavior.
