# Phase 2 Optimization Candidates — Post-Dispatch-Sub-Bucket Profiling

This note updates the optimization backlog after splitting the `scan` command startup path into measurable dispatch sub-buckets.

## Source of truth

- `benchmarks/results/latest/benchmark.json`
- `benchmarks/results/latest/scan-cache.json`

## Latest snapshot

- cold avg: `361.92ms`
- warm avg: `253.95ms`
- partial single avg: `273.89ms`
- partial multi avg: `279.5ms`
- rescan after invalidation avg: `423.58ms`
- warm runtime split:
  - CLI wall time: `253.95ms`
  - internal scan total: `9.96ms`
  - outside-scan overhead: `243.99ms`
- warm outside-scan command-path breakdown:
  - command dispatch: `160.16ms`
  - result serialization: `0.13ms`
  - stdout write: `3.48ms`
  - command-path measured total: `163.77ms`
  - command-path unattributed residual: `80.22ms`
- warm dispatch sub-breakdown:
  - paths module import: `5.99ms`
  - scan module import: `153.84ms`
  - ensure project dirs: `0.29ms`
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

Warm `scan` still spends very little time in the internal scan core.

- warm internal scan total: `9.96ms`
- warm unchanged-file behavior:
  - `fileReadCount: 0`
  - `metadataReuseCount: 81`
  - `reparsedFileCount: 0`

**Implication:** the previous scan-core work remains under control.

### 2. The measured dispatch bucket is now almost fully explained

Warm startup numbers now show:

- `commandDispatchMs: 160.16ms`
- `pathsModuleImportMs: 5.99ms`
- `scanModuleImportMs: 153.84ms`
- `ensureProjectDataDirsMs: 0.29ms`
- `commandDispatchResidualMs: 0.04ms`

**Implication:** the startup bucket is no longer vague. For `scan`, command dispatch is essentially the `scan` module import cost. There is very little unexplained work left inside dispatch itself.

### 3. The next safe target is inside `scan` module load, not report plumbing

Warm non-scan numbers still show very small costs for:

- result serialization: `0.13ms`
- stdout write: `3.48ms`
- benchmark harness stdout parse: `0.22ms`
- artifact write: `0.54ms`

**Implication:** stdout/report persistence remains non-priority. The highest-value safe bucket is now the `scan` module-load path itself.

### 4. There is still residual outside measured dispatch, but it is no longer the best first target

Warm `outsideScanMs` is still `243.99ms`, with `commandPathUnattributedMs` at `80.22ms`.

**Implication:** there is still process/bootstrap overhead outside the measured dispatch window, but the clearest next optimization is the much larger and now-well-explained `scanModuleImportMs` bucket.

### 5. Cold/rescan internal work still points to extract + cache-write when startup work is exhausted

Cold and rescan scenarios still show the largest internal scan-core buckets in:

- `extract`
- `cacheWrite`
- then `discovery`

**Implication:** after startup/module-load work, cold-path extract/cache-write remains ahead of `decide` micro-optimization.

## Re-ranked priority order

### P0 — Narrow the `scanModuleImportMs` bucket

The best next optimization target is now explicit: the `scan` module import itself.

Candidate directions:

- split `src/core/scan.ts` dependencies into lighter-on-import pieces if a safe seam exists
- defer scan-only helper imports until after startup-sensitive code paths where possible
- reduce top-level work in modules loaded by `scan.ts`
- keep the benchmark side-channel additive so `scanModuleImportMs` stays directly comparable

Why first:

- it is the largest safe measured bucket
- the current pass proved dispatch residual is effectively negligible
- it stays within the approved `scan`-only startup scope

### P1 — Residual process/bootstrap overhead outside measured command dispatch

Candidate directions:

- split the remaining `commandPathUnattributedMs` further only if another low-risk seam exists
- inspect what still happens before/after measured dispatch without changing user-visible behavior
- leave this behind direct module-load work unless `scanModuleImportMs` flattens first

Why second:

- it is still meaningful, but now smaller and less actionable than the explicit `scanModuleImportMs` bucket

### P2 — Cold-path extract/cache-write cost

Candidate directions:

- reduce extraction work only after confirming the slow-file list still points there on broader fixtures
- slim or batch cold-path persistence only if representative repos show the same bottleneck
- keep `decide` and product semantics stable while tightening cold-path payload work

Why third:

- startup/module-load is the clearer current user-visible cost center
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

1. Profile what `src/core/scan.ts` pulls in at module-load time.
2. Time scan sub-module imports if another additive seam exists.
3. Confirm whether reducing top-level scan-module work decreases `scanModuleImportMs` without changing `fooks scan` semantics.
4. Revisit residual process/bootstrap timing only after the scan-module bucket flattens.

## Decision rule for the next optimization PR

A follow-up optimization PR should answer all of these with benchmark evidence:

1. Which layer got faster: `scanModuleImportMs`, residual outside-scan time, or cold internal work?
2. What specific field proves it?
3. What stayed correct? (`npm test`, `npm run bench:gate`, benchmark JSON contract)
4. Did the change reduce real user-visible cost, or only move work between adjacent buckets?

That keeps phase-2 work grounded in the newest observability and preserves the rule that the next optimization PR targets the **largest safe measured bucket**, not just the largest bucket on paper.
