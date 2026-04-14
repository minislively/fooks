# Phase 2 Optimization Candidates — Post-Residual-Process-Floor Profiling

This note updates the optimization backlog after measuring how much of the remaining warm startup cost is bare Node/process floor versus fooks-specific CLI/bootstrap work.

## Source of truth

- `benchmarks/results/latest/benchmark.json`
- `benchmarks/results/latest/scan-cache.json`

## Latest snapshot

- cold avg: `648.78ms`
- warm avg: `142.33ms`
- partial single avg: `449.9ms`
- partial multi avg: `398.58ms`
- rescan after invalidation avg: `635ms`
- warm runtime split:
  - CLI wall time: `142.33ms`
  - internal scan total: `14.67ms`
  - outside-scan overhead: `127.66ms`
- warm outside-scan command-path breakdown:
  - command dispatch: `22.51ms`
  - result serialization: `0.18ms`
  - stdout write: `5.84ms`
  - command-path measured total: `28.53ms`
  - command-path unattributed residual: `99.13ms`
- warm dispatch sub-breakdown:
  - paths module import: `7.58ms`
  - scan module import: `14.52ms`
  - ensure project dirs: `0.37ms`
  - command dispatch residual: `0.04ms`
- benchmark harness/process floor:
  - warm stdout parse: `0.32ms`
  - bare Node process: `90.5ms`
  - CLI bootstrap without command: `108.72ms`
  - CLI bootstrap residual: `18.22ms`
  - artifact write: `0.72ms`
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

- warm internal scan total: `14.67ms`
- warm unchanged-file behavior:
  - `fileReadCount: 0`
  - `metadataReuseCount: 81`
  - `reparsedFileCount: 0`

**Implication:** the previous scan-core work remains under control.

### 2. The measured dispatch bucket is still small relative to the process floor

Warm startup numbers now show:

- `commandDispatchMs: 22.51ms`
- `pathsModuleImportMs: 7.58ms`
- `scanModuleImportMs: 14.52ms`
- `ensureProjectDataDirsMs: 0.37ms`
- `commandDispatchResidualMs: 0.04ms`

**Implication:** the fooks-specific measured dispatch work is not the dominant startup cost anymore.

### 3. Report plumbing is still not the next target

Warm non-scan numbers still show very small costs for:

- result serialization: `0.18ms`
- stdout write: `5.84ms`
- benchmark harness stdout parse: `0.32ms`
- artifact write: `0.72ms`

**Implication:** stdout/report persistence remains non-priority.

### 4. Most of the remaining warm startup cost now looks like process floor plus a smaller bootstrap residual

Warm `outsideScanMs` is now `127.66ms`, with `commandPathUnattributedMs` at `99.13ms`.

Harness measurements now show a `bareNodeProcessAvgMs` of `90.5ms` and a `cliBootstrapResidualAvgMs` of `18.22ms`.

**Implication:** most of the remaining warm startup cost is explained by raw process launch plus a much smaller fooks-specific bootstrap residual. That changes the next-priority question from “what does scan import pull in?” to “is the remaining CLI bootstrap residual worth another narrow pass, or have we reached the point where process model dominates?”

### 5. Cold/rescan internal work still points to extract + cache-write when startup work is exhausted

Cold and rescan scenarios still show the largest internal scan-core buckets in:

- `extract`
- `cacheWrite`
- then `discovery`

**Implication:** after startup/module-load work, cold-path extract/cache-write remains ahead of `decide` micro-optimization.

## Re-ranked priority order

### P0 — Decide whether the remaining CLI bootstrap residual is worth another narrow pass

The best next optimization target is no longer the whole residual bucket; it is the smaller fooks-controlled bootstrap residual that sits on top of the bare Node process floor.

Candidate directions:

- inspect what still happens before measured command dispatch but after raw process launch
- only add another seam if it stays additive and keeps `fooks scan` semantics unchanged
- compare any candidate win against the `~90ms` bare Node floor before changing more code
- stop if the next movable bucket is too small relative to benchmark noise

Why first:

- the dominant measured dispatch hotspot has already been reduced
- the harness now explains that much of the residual is not fooks-specific work
- this is the narrowest remaining startup question that can still produce a meaningful product decision

### P1 — Treat bare process launch as a structural limit unless the product model changes

Candidate directions:

- recognize that `bareNodeProcessAvgMs` is outside normal in-process optimization reach
- if startup latency still matters after bootstrap residuals flatten, the next leap may require a different runtime/process model rather than more TypeScript refactors
- do not hide this by endlessly shaving tiny in-process buckets

Why second:

- the process floor is now large enough that further small refactors may have sharply diminishing returns

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

1. Decide whether another additive seam can isolate the CLI bootstrap residual beyond bare process launch.
2. If yes, measure it without changing `fooks scan` semantics.
3. If not, treat the current process floor as the dominant limit and shift attention to cold-path extract/cache-write or product-level runtime strategy.
4. Only revisit scan-module import work if later evidence says that bucket regressed.

## Decision rule for the next optimization PR

A follow-up optimization PR should answer all of these with benchmark evidence:

1. Which layer got faster: CLI bootstrap residual, raw process floor, or cold internal work?
2. What specific field proves it?
3. What stayed correct? (`npm test`, `npm run bench:gate`, benchmark JSON contract)
4. Did the change reduce real user-visible cost, or only move work between adjacent buckets?

That keeps phase-2 work grounded in the newest observability and preserves the rule that the next optimization PR targets the **largest safe measured bucket**, not just the largest bucket on paper.
