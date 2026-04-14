# Phase 2 Optimization Candidates — Post-Startup-Lazy-Load Re-rank

This note updates the optimization backlog after narrowing the `scan` command startup path with command-scoped lazy imports.

## Source of truth

- `benchmarks/results/latest/benchmark.json`
- `benchmarks/results/latest/scan-cache.json`

## Latest snapshot

- cold avg: `324.18ms`
- warm avg: `236.21ms`
- partial single avg: `263.52ms`
- partial multi avg: `263.7ms`
- rescan after invalidation avg: `331.62ms`
- warm runtime split:
  - CLI wall time: `236.21ms`
  - internal scan total: `8.54ms`
  - outside-scan overhead: `227.67ms`
- warm outside-scan command-path breakdown:
  - command dispatch: `148.22ms`
  - result serialization: `0.12ms`
  - stdout write: `3.04ms`
  - command-path measured total: `151.38ms`
  - command-path unattributed residual: `76.29ms`
- benchmark harness overhead:
  - warm stdout parse: `0.19ms`
  - artifact write: `0.61ms`
- extract reduction:
  - `SimpleButton` → `raw` (no reduction target)
  - `FormSection` → `34.59%`
  - `DashboardPanel` → `46.63%`

## What changed in the startup pass

The `scan` command now keeps its CLI contract but avoids eagerly loading unrelated command modules before it knows which command is being executed.

Concretely:

- `src/cli/index.ts` keeps only the thin bootstrap imports at the top level
- `scan`, `extract`, `decide`, `attach`, `install`, `status`, and hook-specific modules are imported inside their command paths
- `scan`-only benchmark timing still uses the `FOOKS_BENCH_TIMING_PATH` side channel, so stdout JSON stays unchanged

## What the new numbers actually show

### 1. Warm scan core is still cheap; the user-visible cost is still mostly outside it

Warm `scan` stays dominated by CLI-visible overhead, not internal scanning work.

- warm internal scan total: `8.54ms`
- warm outside-scan overhead: `227.67ms`
- warm unchanged-file behavior:
  - `fileReadCount: 0`
  - `metadataReuseCount: 81`
  - `reparsedFileCount: 0`

**Implication:** rereading and reparsing unchanged files is not the main problem anymore.

### 2. The opaque residual got much smaller, and the startup/import cost is now measurable inside command dispatch

Before the lazy-load pass, most warm outside-scan cost sat in the unattributed residual. After the pass:

- warm `commandDispatchMs` is now `148.22ms`
- warm `commandPathUnattributedMs` is down to `76.29ms`

That means the previous “opaque bootstrap/process blob” is now much more visible inside the measured command path.

**Implication:** this pass did not magically erase wall time, but it did make the next target clearer. The next safe optimization surface is now the measured `scan` command startup/module-load bucket, not stdout writes, JSON serialization, or benchmark artifact persistence.

### 3. The measured non-scan buckets are small enough to deprioritize

Warm scenario command-path numbers show:

- result serialization: `0.12ms`
- stdout write: `3.04ms`
- benchmark harness stdout parse: `0.19ms`
- artifact write: `0.61ms`

**Implication:** artifact persistence and report printing are not where the next meaningful win lives.

### 4. Cold/rescan cost is still mostly internal extract + cache-write work

Cold and rescan scenarios still show the largest internal scan-core buckets in:

- `extract`
- `cacheWrite`
- then `discovery`

**Implication:** if/when the team leaves startup work and comes back to internal runtime, cold-path extract/cache-write remains ahead of `decide` micro-optimization.

## Re-ranked priority order

### P0 — Narrow the measured `scan` command startup / module-load bucket

The best next optimization target is no longer an opaque residual; it is the now-measured command dispatch bucket.

Candidate directions:

- profile which dynamic imports dominate the `scan` command path
- defer more scan-adjacent setup until after argument validation only if the contract stays identical
- avoid loading command-irrelevant helpers during `scan` startup
- keep proof surfaces additive so the bucket keeps shrinking in measurable steps

Why first:

- it is the largest safe measured bucket
- the current pass proved the startup/import cost is real and no longer hidden
- it keeps the optimization focused on `scan` without widening into adapter/runtime behavior

### P1 — Cold-path extract/cache-write cost

Candidate directions:

- reduce extraction work only after confirming the slow-file list still points there on broader fixtures
- slim or batch cold-path persistence only if benchmark evidence shows it matters beyond the current corpus
- keep `decide` and product semantics stable while tightening cold-path payload work

Why second:

- this remains the clearest internal runtime surface after startup work
- it matters most when caches are cold or deliberately invalidated

### P2 — Residual process/bootstrap overhead outside measured command dispatch

Candidate directions:

- split the remaining `commandPathUnattributedMs` further only if another low-risk seam exists
- inspect what still happens before/after measured command dispatch without changing user-visible behavior
- keep this below direct startup work unless numbers show the residual flattening while wall time stays high

Why third:

- the residual is smaller now
- the higher-value next step is inside the measured startup bucket, not another broad observability detour

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

1. Time sub-buckets inside `scan` command dispatch if a low-risk seam exists.
2. Confirm whether another small lazy-load pass reduces `commandDispatchMs` without changing the command contract.
3. Re-run with larger `FOOKS_BENCH_COPY_COUNT` values only after the startup bucket flattens.
4. Add one or two broader real-world repos before choosing an extract redesign.

## Decision rule for the next optimization PR

A follow-up optimization PR should answer all of these with benchmark evidence:

1. Which layer got faster: measured `scan` startup, residual outside-scan time, or cold internal work?
2. What specific field proves it?
3. What stayed correct? (`npm test`, `npm run bench:gate`, benchmark JSON contract)
4. Did the change reduce real user-visible cost, or only move work between buckets?

That keeps phase-2 work grounded in the newest observability instead of returning to intuition-led tuning, and it preserves the rule that the next optimization PR targets the **largest safe measured bucket**, not just the largest bucket on paper.
