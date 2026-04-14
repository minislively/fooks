# Phase 2 Optimization Candidates — Post-Observability Re-rank

This note updates the optimization backlog after the first scan/discovery/cache-path pass added benchmark-visible observability and conservative unchanged-file short-circuiting.

## Source of truth

- `benchmarks/results/latest/benchmark.json`
- `benchmarks/results/latest/scan-cache.json`

## Latest snapshot

- cold avg: `382.22ms`
- warm avg: `261.29ms`
- partial single avg: `300.95ms`
- partial multi avg: `300.07ms`
- rescan after invalidation avg: `400.66ms`
- extract reduction:
  - `SimpleButton` → `raw` (no reduction target)
  - `FormSection` → `34.59%`
  - `DashboardPanel` → `46.63%`

## What changed in the first optimization pass

The benchmark artifact now carries scan observability that did not exist in phase 1:

- step timings (`discovery`, `stat`, `fileRead`, `hash`, `cacheRead`, `extract`, `cacheWrite`, `indexWrite`, `total`)
- reuse counters (`metadataReuseCount`, `fileReadCount`, `reparsedFileCount`, extraction cache hits/misses)
- discovery counters (`directoriesVisited`, `filesVisited`, `componentFileCount`, `linkedTsCount`, import probe/cache-hit counts)
- per-scenario slow-file summaries

The runtime behavior also changed conservatively:

- warm scans now reuse prior index metadata instead of rereading every unchanged file
- partial scans reread and reparse only changed files when `mtime + size` prove the rest are unchanged
- linked `.ts` discovery now reuses in-scan import-resolution bookkeeping instead of probing the filesystem repeatedly for the same base path

## What the new numbers actually show

### 1. The internal scan path is now much cheaper on warm/partial runs than the end-to-end CLI wall time suggests

The top-line benchmark numbers still show warm/partial runs in the `261–301ms` range, but the new internal observability shows that the actual scan work is far smaller:

- warm internal total: about `10.86ms`
  - `fileReadCount: 0`
  - `metadataReuseCount: 81`
  - `reparsedFileCount: 0`
- partial single internal total: about `27.11ms`
  - `fileReadCount: 1`
  - `metadataReuseCount: 80`
  - `reparsedFileCount: 1`
- partial multi internal total: about `24.28ms`
  - `fileReadCount: 2`
  - `metadataReuseCount: 79`
  - `reparsedFileCount: 2`

**Implication:** the remaining gap in CLI-visible benchmark time is no longer primarily “unchanged files are being reread and reparsed.” That part of the path is now mostly under control.

### 2. Cold/rescan cost is still dominated by extract + cache-write, not decide

Cold-path observability shows the biggest internal buckets are still:

- `extract`
- `cacheWrite`
- to a lesser degree `discovery`

`decide` remains a negligible per-file cost in the current fixture set, so phase-2 work should still avoid mode-decision micro-optimization as a leading priority.

### 3. Discovery remains visible, but no longer looks like the only obvious culprit

Discovery is still a real cost center and now measurable, but the new counters show that import-resolution caching already removes repeated probes inside one run.

**Implication:** future discovery work should be justified by benchmark evidence, not by the old assumption that full-tree walking was automatically the dominant remaining bottleneck.

## Re-ranked priority order

### P0 — End-to-end benchmark/runtime overhead outside unchanged-file rereads

Now that warm/partial scans avoid rereading unchanged files, the next high-value question is:

> why does CLI-visible wall time remain materially larger than the internal scan total?

Candidate directions:

- measure CLI/process startup overhead more explicitly
- inspect JSON artifact construction / serialization overhead in the benchmark path
- reduce duplicated object construction between scan results and benchmark envelopes
- audit whether history/latest writes are paying avoidable cost in local loops

Why first:

- the new observability narrowed the problem
- remaining user-visible cost is now likely outside the old reread/reparse path

### P1 — Cold-path extract/cache-write cost

Cold and full-rescan scenarios still spend most internal time in:

- `extract`
- `cacheWrite`

Candidate directions:

- reduce extraction work only after profiling the slow-file list and confirming repeated AST work is still dominant
- batch or slim cache writes only if benchmark evidence shows persistence cost matters on representative repos
- keep extract/decide semantics stable while tightening hot-path payload generation

Why second:

- this is the clearest remaining internal runtime surface
- it matters most when caches are cold or deliberately invalidated

### P2 — Discovery-path follow-up

Candidate directions:

- tighten walk filters further only if larger-corpus benchmarks show discovery scaling poorly
- consider directory-level snapshots or narrower linked-ts neighborhood reuse only after measuring real repos beyond the synthetic fixture corpus
- keep the linked-ts contract narrow unless product scope changes

Why third:

- discovery is visible but no longer obviously the best next dollar of effort after the first pass

## Explicit non-priority items

Do **not** lead with these unless new benchmark evidence changes the ranking:

- `decideMode` micro-optimizations alone
- broad extract redesign without slow-file profiling evidence
- aggressive skip/invalidation strategies that raise stale-result risk
- CSV export or visualization work
- broad framework expansion

## Suggested next experiments

1. Split benchmark reporting between internal scan total and full CLI wall time in the summary layer.
2. Capture serialization/write timings for benchmark artifact generation separately from core scan timings.
3. Run the benchmark corpus with larger `FOOKS_BENCH_COPY_COUNT` values to see whether discovery or extract scales worse.
4. Add one or two borderline fixtures before any extract/fast-path redesign.

## Decision rule for the next optimization PR

A follow-up optimization PR should answer all of these with benchmark evidence:

1. Which layer got faster: internal scan work, cold extract work, or end-to-end CLI/runtime overhead?
2. What specific observability field proves it?
3. What stayed correct? (`npm test`, `npm run bench:gate`, benchmark JSON contract)
4. Did the change reduce real user-visible cost, or only move work between buckets?

That keeps phase-2 work grounded in the new observability instead of returning to intuition-led tuning.
