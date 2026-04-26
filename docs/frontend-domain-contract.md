# Frontend domain contract

This contract is the final pre-detector gate for frontend-family domain work. It does **not** add runtime support, parser behavior, extractor behavior, setup eligibility, or public support wording. It defines the language fooks uses before any later domain detector or profile implementation PR.

The intended sequence is:

```text
frontend domain contract -> fixture expectation manifest -> domain detector -> profile implementation
```

The existing fixture expectation baseline in `test/fixtures/frontend-domain-expectations/manifest.json` remains the manifest gate between this contract and later detector/profile work. This contract does not imply, require, or perform a manifest schema migration.

## Domain taxonomy

| Domain | Contract meaning | Default stance before promotion | Public wording boundary |
| --- | --- | --- | --- |
| React Web | DOM-ish React `.tsx` / `.jsx` with web JSX, form/control elements, handlers, props, `className`, style, and current measured extraction patterns. | `extract` only for the already measured React web path and protected regressions. | May describe current measured React web extraction scope; do not generalize to all frontend frameworks. |
| React Native | React components with `react-native` primitives such as `View`, `Text`, `TextInput`, `Pressable`, `Touchable*`, `FlatList`, `StyleSheet.create`, platform, or navigation signals. | Evidence lane, deferred lane, or fallback-first until a later RN profile plan proves exact scope. | No React Native support claim from TSX parsing or fixture evidence alone. |
| WebView | Embedded WebView / bridge surfaces such as `react-native-webview`, `source`, injected JavaScript, `onMessage`, URL/HTML sources, or native/web message boundaries. | Fallback-first. Bridge, message, source, sandbox, and compact-payload behavior require a later reviewed plan. | No WebView support claim, no WebView compact-payload reuse claim, and no bridge/message safety claim. |
| TUI/Ink | React CLI / Ink-like TSX evidence with terminal layout, text, prompt, status, keyboard/input, or command-view signals. | Evidence lane only. TSX extraction evidence for local fixtures is not broad terminal UI semantics. | No broad TUI support claim and no default TUI compact extraction claim. |
| Mixed | Files with overlapping risky markers, such as RN plus WebView, web plus native, CLI plus runtime/process side effects, or other cross-domain ambiguity. | Fallback or unsupported boundary unless a later plan gives an exact measured rule. | Must not be used to promote any single domain support claim. |
| Unknown | Files without enough stable domain signals or with source shapes outside the measured frontend-family contract. | Deferred or fallback. Unknown does not default to extraction. | No support wording beyond “not current support,” “deferred,” or “normal source reading.” |

## Outcome vocabulary

| Outcome | Meaning | Boundary |
| --- | --- | --- |
| `extract` | fooks may produce a compact/model-facing extraction for the measured scope named by the fixture/profile. | `extract` is scoped evidence, not universal support for the domain label. |
| `fallback` | fooks should keep normal source reading or a full-source path because compact extraction would be unsafe or under-evidenced. | Fallback is the safe default for WebView, Mixed, Unknown, and risky native boundaries. |
| `deferred` | The lane is intentionally not assigned an exact behavior until fixtures, rules, and wording boundaries are ready. | Deferred work must not be described as support. |
| `unsupported` | An explicit boundary where fooks should not present compact extraction or support wording for the file/lane. | Use only when a testable reason is documented. |

## Detection contract, not implementation

A future detector may use signals such as imports, JSX tags, source props, handlers, and file patterns, but this PR does not implement that detector. The contract-level intent is:

1. WebView markers outrank broad JSX extractability and stay fallback-first.
2. React Native markers are RN evidence, not DOM/form semantics.
3. TUI/Ink markers are CLI evidence, not arbitrary terminal UI support.
4. Mixed risky markers choose fallback or unsupported before extraction.
5. Unknown files do not receive compact extraction just because TSX/JSX parsing succeeds.
6. React Web extraction stays bounded to current measured React web signals.

## Public claim boundaries

Allowed wording for pre-promotion work:

- “evidence lane”
- “deferred lane”
- “fallback-first”
- “not current support”
- “normal source reading”
- “experimental candidate” only after a separate implementation plan approves exact scope

Forbidden positive claim categories before a later reviewed implementation plan:

- A claim that React Native is available or currently supported.
- A claim that WebView is available or currently supported.
- A claim that WebView compact-payload reuse is currently supported.
- A claim that broad TUI or TUI/Ink behavior is available or currently supported.
- A claim that WebView compact extraction is on by default.
- A claim that TUI compact extraction is on by default.

Safe negative wording remains allowed, for example: “no default WebView compact payload reuse.”

## Fixture expectation manifest gate

The fixture expectation manifest is the gate between this contract and detector/profile work. A later detector/profile plan should not start from the taxonomy alone; it should reference manifest entries that state:

- fixture path and source kind;
- domain/lane and required signals;
- exact expected outcome: `extract`, `fallback`, `deferred`, or `unsupported`;
- boundary reason when fallback or unsupported is expected;
- claim boundary for public wording.

This contract does not migrate the manifest schema. If the current manifest becomes too hard to review, a separate plan should propose a schema or shard migration.

## Shard triggers

Keep the central contract and manifest structure until at least one trigger is observed:

1. The central manifest or contract becomes too large for reviewers to isolate domain-specific changes.
2. Repeated merge conflicts occur in central domain expectation files.
3. WebView bridge/security boundary work needs ownership separate from RN, TUI, and React Web lanes.
4. A coordinated parallel implementation is approved across RN, WebView, TUI/Ink, and React Web lanes.
5. A domain is promoted to experimental detector/profile work with enough tests to justify separate ownership.

Documenting these triggers does not perform sharding.

## Next detector/profile gate

The next implementation-oriented lane may be planned only after this contract and the fixture expectation manifest remain green under regression tests. That later detector/profile plan must name:

- the exact domain and fixture IDs it affects;
- detector signals and precedence rules;
- fallback/unsupported behavior for mixed and risky files;
- public wording allowed for the measured scope;
- verification commands proving no RN/WebView/TUI broad support claim was introduced.
