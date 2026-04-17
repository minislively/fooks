# Ambiguous Formbricks N=5 quality-gated benchmark

Date: 2026-04-17
Runner: direct `codex exec --full-auto` for both vanilla and fooks variants
Repo: external OSS `formbricks/formbricks` checkout under `~/Workspace/fooks-test-repos/formbricks`
Surface: Next.js app login form with Tailwind styling
Task: ambiguous login password Caps Lock warning discovery
Fooks policy: `contextMode=auto`, `expectedFooksPrepare=scan-attach`

## Prompt

```text
Find the Formbricks login password field and add an inline Tailwind red Caps Lock warning below the password field when getModifierState('CapsLock') is true. Keep existing login, email sign-in, password reset, and two-factor flows unchanged. Report which file you modified.
```

## Executive read

- Raw N=5 median still looks directionally positive on wall-clock: total-time improvement `+12.59%`, exec-time improvement `+13.60%`.
- Raw N=5 median runtime-token reduction is only `+3.62%`. This is much weaker than the proxy compression estimate, whose median is `+71.97%`; do not conflate proxy context compression with actual model tokens used by Codex.
- Fooks artifact acceptance passed only `2/5` runs. Failures were missing accessible announcements in two runs and a broad locale/file-scope expansion in one run.
- Fooks broadened edit scope in `1/5` run and had the exact same changed-file list as vanilla in `3/5` runs.
- Quality-gated pairs, requiring both variants to pass acceptance and fooks not to broaden scope, leave only `N=2`. Their median total-time improvement is `-0.99%` and median runtime-token reduction is `-20.11%`.
- Fully claimable positive pairs, requiring quality pass, no broader scope, faster total time, and fewer runtime tokens, were `1/5`.

**Decision:** this ambiguous slice is useful for internal diagnosis but is **not public-claimable yet**. Fooks can win large on some ambiguous discovery runs, but the win is not stable once output quality and actual runtime tokens are gated.

## Per-run results

| Run | Report | Vanilla total | Fooks total | Total improvement | Vanilla tokens | Fooks tokens | Runtime-token reduction | File scope | Acceptance | Fooks failure reason |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 1 | `benchmark-full-1776432928.json` | 342.7s | 217.8s | +36.44% | 114,653 | 60,319 | +47.39% | 2 -> 2 (same) | vanilla 9/9 pass; fooks 8/9 fail | accessible_announcement |
| 2 | `benchmark-full-1776433512.json` | 277.4s | 325.2s | -17.23% | 98,924 | 109,562 | -10.75% | 2 -> 15 (broader) | vanilla 9/9 pass; fooks 7/9 fail | locale_scope_capped, file_scope_capped |
| 3 | `benchmark-full-1776434140.json` | 331.3s | 217.4s | +34.38% | 129,562 | 56,450 | +56.43% | 2 -> 2 (same) | vanilla 8/9 fail; fooks 8/9 fail | accessible_announcement |
| 4 | `benchmark-full-1776434714.json` | 227.5s | 260.6s | -14.57% | 65,119 | 93,661 | -43.83% | 2 -> 1 (narrower/different) | vanilla 9/9 pass; fooks 9/9 pass | — |
| 5 | `benchmark-full-1776435229.json` | 316.8s | 277.0s | +12.59% | 75,755 | 73,015 | +3.62% | 2 -> 2 (same) | vanilla 9/9 pass; fooks 9/9 pass | — |

## Quality-gated read

| Run | Why it passed the gate | Total improvement | Runtime-token reduction | Product read |
| ---: | --- | ---: | ---: | --- |
| 4 | both artifacts passed acceptance and fooks did not broaden scope | -14.57% | -43.83% | quality passed, but performance/token regression |
| 5 | both artifacts passed acceptance and fooks did not broaden scope | +12.59% | +3.62% | positive evidence |

## Product decision impact

- **Exact-file edits remain a non-goal for acceleration.** The bypass removes avoidable preparation overhead, but exact-file runs still need repeated neutral-or-better time, token, and quality evidence before they become a claim.
- **Ambiguous discovery remains the best candidate lane, but only with gates.** Raw medians show fooks can reduce time and tokens when it finds the right component, yet quality-gated evidence collapses to `N=2` and is not positive on median runtime tokens.
- **Runtime-token regressions are a product risk, not a caveat to hide.** Run 4 passed artifact quality but used `43.83%` more runtime tokens and was `14.57%` slower, proving quality alone is insufficient.
- **Scope discipline is mandatory.** Run 2 changed 15 files versus vanilla 2 files, failing locale/file-scope gates even though it implemented the behavior.
- **Accessibility is a recurring acceptance risk.** Runs 1 and 3 missed `role`/`aria-live` style accessible announcement requirements for fooks; run 3 shows vanilla can also miss it, so this should stay an automatic gate rather than a manual note.

## Updated risk table

| Risk | Current status after ambiguous N=5 | Next resolution step |
| --- | --- | --- |
| Actual runtime tokens worse than vanilla | Still open. Raw median is only `+3.62%`, quality-gated median is `-20.11%`, and 2/5 fooks runs used more runtime tokens. | Keep runtime-token outlier gating; do not claim token savings unless quality-gated N>=5 has positive median and no severe fooks>vanilla outlier. |
| Artifact quality parity | Still open. Fooks passed 2/5; failures came from accessibility and over-broad locale scope. | Add/verify prompt or context guidance that preserves accessible announcement requirements and caps locale edits unless explicitly requested. |
| Ambiguous discovery speed | Partially promising. Raw median total improvement was `+12.59%`, but quality-gated median was `-0.99%` over only two passing pairs. | Repeat after fixing quality/scope behavior; use claimable-positive rate, not raw median alone. |
| Scope expansion | Improved but not solved. 1/5 run broadened to 15 files. | Treat `fooks_files > vanilla_files` as a hard benchmark failure unless the task explicitly asks for broad localization/refactor scope. |
| Proxy compression vs actual runtime tokens | Open communication risk. Proxy median says `+71.97%`, while actual runtime-token median says only `+3.62%`. | Report proxy compression as context-size evidence only; product claims must use actual Codex runtime tokens. |

## Recommended next sequence

1. Keep this benchmark as the current decision baseline: **not claimable externally, useful internally**.
2. Make quality/scope constraints more explicit in the fooks context or benchmark prompt only if that reflects real product behavior; avoid overfitting by adding a second ambiguous task family next.
3. Add a second ambiguous class where fooks should theoretically help more: multi-file component extraction or migration in a large Next.js/Tailwind surface, with an acceptance scorer before timing claims.
4. After quality gates are stable, rerun ambiguous N=5 and require: fooks acceptance pass rate >= 4/5, zero broader-scope failures, positive quality-gated median total time, positive quality-gated median runtime-token reduction.

