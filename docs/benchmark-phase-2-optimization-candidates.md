# Phase 2 Optimization Candidates — Post-Scan-Module-Load Narrowing

This note updates the optimization backlog after narrowing the previously dominant `scan` module-load cost and rerunning the benchmark suite.

## Source of truth

- `benchmarks/results/latest/benchmark.json`
- `benchmarks/results/latest/scan-cache.json`

## Latest snapshot

- cold avg: `384.81ms`
- warm avg: `132.09ms`
- partial single avg: `293.92ms`
- partial multi avg: `298.89ms`
- rescan after invalidation avg: `379.81ms`
- warm runtime split:
  - CLI wall time: `132.09ms`
  - internal scan total: `12.1ms`
  - outside-scan overhead: `119.99ms`
- warm outside-scan command-path breakdown:
  - command dispatch: `19.36ms`
  - result serialization: `0.39ms`
  - stdout write: `6.27ms`
  - command-path measured total: `26.02ms`
  - command-path unattributed residual: `93.97ms`
- warm dispatch sub-breakdown:
  - paths module import: `5.62ms`
  - scan module import: `13.47ms`
  - ensure project dirs: `0.23ms`
  - command dispatch residual: `0.04ms`
- benchmark harness overhead:
  - warm stdout parse: `0.22ms`
  - artifact write: `0.54ms`
- extract reduction:
  - `SimpleButton` → `raw` (no reduction target)
  - `FormSection` → `34.59%`
  - `DashboardPanel` → `46.63%`

## What changed in the profiling pass

The benchmark transport for `fooks scan` is still side-channel only, but it now exposes the `commandDispatchMs` bucket as smaller startup pieces:

- `pathsModuleImportMs`
- `scanModuleImportMs`
- `ensureProjectDataDirsMs`
- `commandDispatchResidualMs`

This keeps the CLI contract untouched while turning the previously broad dispatch bucket into something the next optimization PR can directly target.

## What the new numbers actually show

### 1. Warm scan core is still cheap; repeated rereads are still not the main issue

Warm `scan` still spends very little time in the internal scan core, even after the startup refactor.

- warm internal scan total: `12.1ms`
- warm unchanged-file behavior:
  - `fileReadCount: 0`
  - `metadataReuseCount: 81`
  - `reparsedFileCount: 0`

**Implication:** the previous scan-core work remains under control.

### 2. The measured dispatch bucket is no longer the dominant startup problem

Warm startup numbers now show:

- `commandDispatchMs: 19.36ms`
- `pathsModuleImportMs: 5.62ms`
- `scanModuleImportMs: 13.47ms`
- `ensureProjectDataDirsMs: 0.23ms`
- `commandDispatchResidualMs: 0.04ms`

**Implication:** the previous `scan` module-load hotspot collapsed. Dispatch is now small enough that it should no longer lead the backlog by itself.

### 3. Report plumbing is still not the next target

Warm non-scan numbers still show very small costs for:

- result serialization: `0.39ms`
- stdout write: `6.27ms`
- benchmark harness stdout parse: `0.22ms`
- artifact write: `0.54ms`

**Implication:** stdout/report persistence remains non-priority.

### 4. Residual outside measured dispatch is now the clearest remaining startup bucket

Warm `outsideScanMs` is now `119.99ms`, with `commandPathUnattributedMs` at `93.97ms`.

**Implication:** after shrinking `scanModuleImportMs`, the next safe startup target is the residual process/bootstrap overhead outside the measured command path.

### 5. Cold/rescan internal work still points to extract + cache-write when startup work is exhausted

Cold and rescan scenarios still show the largest internal scan-core buckets in:

- `extract`
- `cacheWrite`
- then `discovery`

**Implication:** after startup/module-load work, cold-path extract/cache-write remains ahead of `decide` micro-optimization.

## Re-ranked priority order

### P0 — Profile and narrow residual process/bootstrap overhead outside measured dispatch

The best next optimization target is now the residual startup/process overhead that still sits outside the measured dispatch window.

Candidate directions:

- split the remaining startup window into safer sub-buckets if another additive seam exists
- inspect what still happens before and after the measured command path without changing `fooks scan` semantics
- prefer low-risk process/bootstrap instrumentation before another behavior change
- keep the benchmark side-channel additive so residual startup time stays comparable

Why first:

- the dominant measured dispatch hotspot has already been reduced
- the largest remaining warm startup cost is now outside the measured command path
- it stays within the approved startup-focused scope as long as the CLI contract remains unchanged

### P1 — Re-check `scanModuleImportMs` only if new residual splits point back into module-load work

Candidate directions:

- keep comparing `scanModuleImportMs` to the residual bucket after each startup pass
- revisit deeper `scan` import seams only if residual process/bootstrap profiling points back into scan-adjacent module load
- avoid widening scope into cold-path work until startup evidence says this bucket matters again

Why second:

- `scanModuleImportMs` is no longer the overwhelming hotspot it was in the previous pass

### P2 — Cold-path extract/cache-write cost

Candidate directions:

- reduce extraction work only after confirming the slow-file list still points there on broader fixtures
- slim or batch cold-path persistence only if representative repos show the same bottleneck
- keep `decide` and product semantics stable while tightening cold-path payload work

Why third:

- startup/process overhead is still the clearer current user-visible cost center
- cold-path internal work is still important, but no longer the next safest win

## Explicit non-priority items

Do **not** lead with these unless new benchmark evidence changes the ranking:

- stdout write tuning
- benchmark artifact persistence tuning
- `decideMode` micro-optimizations alone
- broad extract redesign without slow-file profiling evidence
- aggressive skip/invalidation strategies that raise stale-result risk
- CSV export or visualization work
- toolchain changes such as bundling or ESM migration

## Suggested next experiments

1. Split residual process/bootstrap overhead into the next safe measured seam.
2. Confirm whether the residual bucket can be attributed without changing `fooks scan` semantics.
3. Keep comparing residual startup cost against `scanModuleImportMs` so work does not drift back into a solved bucket.
4. Revisit cold-path extract/cache-write only after startup residuals flatten or stop responding.

## Decision rule for the next optimization PR

A follow-up optimization PR should answer all of these with benchmark evidence:

1. Which layer got faster: residual outside-scan time, `scanModuleImportMs`, or cold internal work?
2. What specific field proves it?
3. What stayed correct? (`npm test`, `npm run bench:gate`, benchmark JSON contract)
4. Did the change reduce real user-visible cost, or only move work between adjacent buckets?

That keeps phase-2 work grounded in the newest observability and preserves the rule that the next optimization PR targets the **largest safe measured bucket**, not just the largest bucket on paper.
