# Phase 2 Optimization Candidates — Benchmark-Driven Priorities

This note turns the phase-1 benchmark baseline into a short list of likely optimization targets.

## Baseline reference

Source of truth:
- `benchmarks/results/latest/benchmark.json`

Latest observed phase-1 snapshot:
- cold avg: `315.99ms`
- warm avg: `237.97ms`
- partial single avg: `260.53ms`
- partial multi avg: `256.94ms`
- rescan after invalidation avg: `316.06ms`
- extract reduction:
  - `SimpleButton` → `raw` (no reduction target)
  - `FormSection` → `34.59%`
  - `DashboardPanel` → `46.63%`

## What the numbers suggest

### 1. The biggest opportunity is still in scan-path overhead, not extract/decide micro-cost

The repeated-run benchmark shows that:
- cold scan is much slower than extract timings
- warm and partial scans are faster, but still dominated by repo traversal / file IO / cache bookkeeping rather than `decideMode`
- extract timings are already in the low single-digit millisecond range for the current v1 fixtures

**Implication:**
Phase 2 should prioritize scan/discovery/cache-path work before trying to micro-optimize `decide` logic.

## Recommended priority order

### P0 — Scan/discover/cache path

#### Candidate A — Reduce repeated full-tree walking cost
Current scan still pays for:
- full project walk
- import resolution for linked `.ts`
- per-file reads even when caches are warm

Potential directions:
- tighten walk filters earlier
- reduce redundant path/extension checks
- cache import-resolution side data during a single scan
- avoid re-reading files where index metadata is already enough to short-circuit

Why first:
- largest end-to-end timing surface
- benefits cold, warm, and partial paths together

#### Candidate B — Improve partial invalidation precision
Current partial single (`260.53ms`) and partial multi (`256.94ms`) are both better than cold, but still relatively close to warm scan cost.

Potential directions:
- reduce work done after invalidation when unchanged files dominate
- avoid recomputing linked-ts eligibility for untouched neighborhoods
- shrink index rewrite / result materialization cost on small invalidations

Why second:
- likely highest practical UX gain for iterative real-world use

### P1 — Result persistence / output path

#### Candidate C — Lower JSON/result writing overhead
The suite currently persists canonical artifacts for every run.

Potential directions:
- keep latest/history writes, but reduce repeated stringify/write overhead where possible
- avoid duplicated object construction between suite reports and final envelope
- make history writing optional behind an env flag if local iteration speed becomes an issue

Why third:
- useful if benchmark execution itself becomes part of the developer loop
- lower impact on product runtime than scan-path work

### P2 — Extraction quality/cost tradeoffs

#### Candidate D — Compression strategy tuning for borderline files
Current v1 fixtures show:
- compressed/hybrid targets are already delivering meaningful reduction
- raw presentational files can legitimately expand in JSON form

Potential directions:
- add more benchmark fixtures for borderline cases
- tune compressed/hybrid boundaries only after more fixture diversity exists
- optimize output shape only when it improves payload usefulness and not just byte count

Why later:
- current data does not show extraction cost as the dominant bottleneck
- premature tuning risks optimizing benchmark cosmetics instead of real workflow speed

## Explicit non-priority items for phase 2

Do **not** lead with these unless benchmark evidence changes:
- `decideMode` micro-optimizations alone
- CSV export
- visualization dashboard work
- broad framework expansion
- richer trend/history system before runtime bottlenecks are addressed

## Suggested next benchmark-informed experiments

1. Compare scan timings with a larger synthetic corpus size (`FOOKS_BENCH_COPY_COUNT`)
2. Add one or two realistic borderline fixtures (state-light but long, or hook-heavy but shallow)
3. Profile scan execution with lightweight internal timing splits:
   - discovery
   - cache read
   - extract fallback path
   - index/result write
4. Re-rank priorities after a second baseline capture

## Decision rule for future optimization PRs

A phase-2 optimization PR should answer all of these with benchmark evidence:
1. Which suite/layer got faster?
2. By how much on the canonical JSON artifact?
3. What stayed correct? (`bench:gate`, tests)
4. Did the change improve cold, warm, or partial behavior — or only one path?

That keeps optimization work grounded in the phase-1 benchmark system instead of intuition.
