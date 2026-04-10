# PRD

## 프론트엔드 코드 전용 AI 컨텍스트 훅 엔진 (fxxks)

**문서 버전:** v0.1  
**문서 상태:** Draft  
**대상 범위:** PHASE 1 MVP  
**작성 목적:** React/TSX 프론트엔드 파일 읽기 비용 절감을 위한 로컬 컨텍스트 압축 엔진 정의

> 초기 PHASE 1 드래프트에서는 `fe-lens`라는 작업명을 사용했지만, 현재 제품/레포/패키지/CLI 이름은 `fxxks`로 통일한다.

---

## 1. 제품 개요

### 1-1. 한 줄 정의

**fxxks는 Claude Code / Codex / OMC / OMX 같은 AI 코딩 런타임에서 프론트엔드 파일을 읽기 전에, 원문 전체 대신 구조·계약·행동 중심의 압축 컨텍스트를 제공해 토큰 비용을 줄이는 로컬 엔진이다.**

### 1-2. PHASE 1 정의

PHASE 1은 범용 코드 엔진을 만드는 단계가 아니다.  
오직 한 가지 문제만 해결한다.

**React/TSX 프론트엔드 파일을 AI가 읽을 때, 불필요한 마크업/스타일 보일러플레이트를 줄여 토큰 낭비를 줄인다.**

즉 PHASE 1은 아래에만 집중한다.

- 프론트엔드 전용
- 파일 read 최적화 전용
- 공통 core + adapter 구조 확보
- 향후 OMC / OMX / 기타 런타임으로 확장 가능한 구조 설계

---

## 2. 배경 및 문제 정의

프론트엔드 유지보수와 리팩토링에서 AI 비용이 커지는 핵심 이유는 다음과 같다.

- TSX 파일 자체가 길다
- JSX 마크업 반복이 많다
- 스타일 관련 코드가 불필요하게 길다
- 공통 UI 패턴을 매번 원문 전체로 다시 읽게 된다
- 실제로 중요한 정보는 구조, props, hooks, 이벤트 흐름인데 AI는 전체 파일을 다시 ingest한다

결과적으로 AI는 다음보다 훨씬 많은 비용을 지불하고 있다.

- 컴포넌트가 무엇을 렌더링하는지
- 어떤 props 계약을 갖는지
- 어떤 hooks와 상태를 사용하는지
- 어떤 이벤트와 side effect가 있는지

즉 현재 문제는 “코드 이해 부족”이 아니라, **프론트엔드 파일 read 단계에서 발생하는 비효율적인 토큰 소비**다.

---

## 3. 문제 진술

### 해결하려는 문제

AI 코딩 런타임이 React/TSX 파일을 읽을 때, 실제 의미 정보보다 마크업/스타일 보일러플레이트를 과도하게 소비하여 토큰 비용이 커지고 있다.

### PHASE 1의 해결 방식

파일 전체를 무조건 요약하지 않고, 파일 특성에 따라 아래 세 가지 중 하나를 선택한다.

- **Raw:** 원문 그대로 전달
- **Compressed:** 구조·계약·행동 중심으로 압축 전달
- **Hybrid:** 압축 요약 + 핵심 snippet 일부 전달

---

## 4. 목표와 비목표

## 4-1. 목표

### 제품 목표

1. React/TSX 프론트엔드 파일 read 비용을 줄인다.
2. 긴 파일에서도 AI가 필요한 의미 정보를 우선적으로 받을 수 있게 한다.
3. 특정 런타임에 종속되지 않는 공통 core engine 구조를 만든다.
4. Claude/Codex 계열에 우선 attach 가능하도록 adapter 구조를 확보한다.

### 사용자 목표

1. 긴 TSX 파일을 AI에 덜 비싸게 읽힌다.
2. 파일 read 속도 체감이 크게 나빠지지 않는다.
3. 요약 때문에 코드 이해 품질이 크게 깨지지 않는다.

---

## 4-2. 비목표

PHASE 1에서는 아래를 다루지 않는다.

- 백엔드 코드
- 일반 Node 스크립트
- 인프라/설정 파일
- lint 특화 처리
- js → ts migration 특화 처리
- diagnostics(tsc/eslint) 입력 처리
- CSS 정밀 semantic 분석
- Vue / Svelte 등 타 프레임워크
- 범용 코드 압축 엔진화

즉 PHASE 1은 철저히 **“프론트엔드 파일 읽기 비용 절감”**만 다룬다.

---

## 5. 제품 원칙

### 원칙 1. 프론트엔드 전용으로 좁게 시작

처음부터 범용 코드 엔진처럼 만들지 않는다.  
React 프론트엔드 전용으로 품질을 먼저 확보한다.

### 원칙 2. 내부 구조는 범용 확장 가능하게 설계

기능은 프론트엔드 전용이어도 구조는 다음처럼 일반화한다.

- core engine
- adapter layer
- attach 방식
- 공통 schema

이를 통해 향후 OMC / OMX / 기타 런타임을 같은 방식으로 연결할 수 있어야 한다.

### 원칙 3. 무조건 요약하지 않는다

좋은 원문은 유지하고, 낭비되는 원문만 압축한다.  
모든 파일에 compression을 강제하지 않는다.

---

## 6. 대상 사용자 및 주요 사용 시나리오

## 6-1. 대상 사용자

- React 프론트엔드 유지보수 개발자
- AI를 이용해 리팩토링/수정/탐색하는 개발자
- Claude Code / Codex 계열 런타임 사용 팀
- 향후 OMC / OMX 등 다른 AI 코딩 런타임에 연결하려는 도구 제작자

## 6-2. 대표 사용 시나리오

### 시나리오 A. 긴 TSX 파일 분석

개발자가 AI에게 특정 컴포넌트 수정을 요청한다.  
런타임은 해당 파일을 fxxks에 먼저 질의하고, fxxks는 원문 대신 압축 컨텍스트를 제공한다.

### 시나리오 B. 작은 파일은 원문 유지

짧고 단순한 버튼 컴포넌트는 굳이 압축하지 않고 raw로 제공한다.

### 시나리오 C. 복잡 파일은 hybrid

렌더링 분기, 이벤트, 훅, 스타일 분기가 섞인 복잡 컴포넌트는 압축 요약과 핵심 snippet을 함께 제공한다.

### 시나리오 D. 런타임 연결

Claude/Codex 계열에서 attach된 adapter가 core engine 결과를 적절한 형태로 주입한다.

---

## 7. 범위

## 7-1. 포함 범위

### 대상 파일

- `.tsx`
- `.jsx`
- 필요 시 `.ts` 일부
  - 컴포넌트와 직접 연결된 타입
  - props 정의
  - 직접 연관된 유틸

### 기능 범위

- 프로젝트 scan / index
- 파일 read 시 raw / compressed / hybrid 판단
- 공통 core engine
- adapter 구조
- project-shared cache
- Claude/Codex 계열 우선 attach 가능 구조

---

## 7-2. 제외 범위

- 백엔드
- Node 스크립트
- diagnostics 기반 해석
- 정교한 CSS semantic compression
- Lint / migration / fix-mode
- 프레임워크 확장

---

## 8. 핵심 가치 제안

fxxks는 UI를 “그림처럼 자세히 재현”하지 않는다.  
대신 AI가 실제로 작업에 필요한 정보만 우선 제공한다.

즉 PHASE 1의 압축 기준은 다음과 같다.

- 무엇이 렌더링되는가
- 어떤 계약(props/export)을 갖는가
- 어떤 상태와 훅이 있는가
- 어떤 이벤트와 부수효과가 있는가
- 스타일 시스템이 무엇이며 핵심 레이아웃 정보가 무엇인가

---

## 9. 기능 요구사항

## 9-1. Project Scan

### 명령어

```bash
fxxks scan
```

### 목적

프로젝트 내 프론트엔드 파일을 수집하고, 이후 extract/decide/attach가 빠르게 동작할 수 있도록 인덱스와 캐시를 생성한다.

### 세부 요구사항

- 프로젝트 내 대상 파일 탐색
- React 컴포넌트 후보 식별
- export/props/hooks/style system 기본 추출
- 파일 해시 생성
- 인덱스 파일 생성
- 캐시 저장

### 최소 저장 정보

- component name
- file path
- export map
- props contract
- hooks used
- style system
- file hash

### 기대 결과

- 이후 동일 파일 재분석 시 재사용 가능
- 프로젝트 단위 공통 캐시 유지
- attach adapter가 core 정보를 재사용 가능

---

## 9-2. File Extract

### 명령어

```bash
fxxks extract src/components/Button.tsx --json
```

### 목적

특정 파일에 대한 압축 결과를 직접 확인하고, adapter 없이도 core 엔진의 품질을 검증할 수 있도록 한다.

### 세부 요구사항

- 지정 파일을 분석한다
- 공통 schema로 결과를 반환한다
- 원문 자체를 대체할 수 있는 압축 정보 또는 hybrid 정보를 생성한다
- JSON 출력 지원

### 기대 결과

- 개발자는 압축 품질을 독립적으로 검증 가능
- adapter 개발 전에도 core 결과를 테스트 가능

---

## 9-3. Mode Decide

### 명령어

```bash
fxxks decide src/components/Button.tsx
```

### 목적

파일 read 시 raw / compressed / hybrid 중 어떤 모드가 적절한지 결정한다.

### 판단 기준

- line 수
- JSX depth
- hooks 수
- conditional render 수
- event handler 수
- style branching
- import 복잡도

### 세부 요구사항

- 정량/정성 기준을 기반으로 mode를 결정한다
- 결과에 선택 이유를 포함할 수 있어야 한다
- mode 결정은 attach 단계에서도 재사용 가능해야 한다

### 기대 결과

- 작은 파일은 불필요한 압축을 피함
- 큰 파일은 토큰 낭비를 줄임
- 복잡 파일은 hybrid로 안전하게 처리

---

## 9-4. Attachable Adapter 구조

### 명령어

```bash
fxxks attach claude
fxxks attach codex
```

### 목적

특정 런타임이 fxxks core engine을 호출할 수 있도록 연결부를 설치한다.

### PHASE 1 최소 요구

- Claude 계열 adapter 1개 이상
- Codex 계열 adapter 1개 이상 또는 attach 가능 구조 검증

### 구조 요구사항

- adapter는 core schema를 소비해야 한다
- core는 특정 툴 포맷에 직접 종속되지 않아야 한다
- 이후 OMC/OMX adapter를 같은 방식으로 추가 가능해야 한다

### 기대 결과

- 런타임별 연결은 adapter 레이어에 한정
- scan/extract/decide/cache/schema는 core에 유지

---

## 10. 압축 모델 정의

PHASE 1에서 파일은 아래 4개 레이어로 해석한다.

### A. Structure

- JSX 주요 섹션
- 큰 블록 구조
- 반복 렌더링 위치
- 조건부 렌더링 위치

### B. Contract

- 컴포넌트 이름
- export 형태
- props/interface/type
- ref forwarding 여부

### C. Behavior

- hooks 사용 여부
- state/effect
- 주요 이벤트 핸들러
- side effect 존재 여부

### D. Style

- tailwind / css module / styled-components 사용 여부
- layout/visibility 관련 핵심 정보

PHASE 1은 이 4개 레이어를 기반으로 **의미 정보 중심 압축**을 수행한다.

---

## 11. 출력 모드 정의

## 11-1. Raw

작고 단순한 파일은 원문 그대로 전달한다.

### 사용 조건 예

- 짧은 line 수
- 얕은 JSX depth
- 조건 분기 적음
- 훅/이벤트 수 적음

### 기대 효과

- 불필요한 요약 오차 없음
- 작은 파일에서 품질 손실 방지

---

## 11-2. Compressed

큰 프론트엔드 파일은 압축 요약 전달을 우선한다.

### 포함 정보 예

- component/export 이름
- props contract
- hooks used
- structure summary
- behavior summary
- style summary

### 기대 효과

- 긴 TSX 파일의 토큰 절감
- 반복 마크업/스타일 코드 소비 최소화

---

## 11-3. Hybrid

복잡한 파일은 압축 요약과 핵심 snippet 일부를 함께 제공한다.

### 포함 정보 예

- 압축 요약
- 중요한 조건부 렌더 블록
- 핵심 이벤트 핸들러
- 주요 구조를 보여주는 snippet

### 기대 효과

- 요약 안정성과 원문 신뢰도를 동시에 확보
- PHASE 1에서 가장 안전한 기본 전략이 될 수 있음

---

## 12. 공통 스키마 요구사항

core engine은 런타임 비종속 공통 schema를 반환해야 한다.

### 최소 스키마 필드

```ts
type ExtractionResult = {
  filePath: string;
  fileHash: string;
  language: "tsx" | "jsx" | "ts";
  mode: "raw" | "compressed" | "hybrid";

  componentName?: string;
  exports: Array<{
    name: string;
    kind: "default" | "named";
    type?: string;
  }>;

  contract?: {
    propsName?: string;
    propsSummary?: string[];
    hasForwardRef?: boolean;
  };

  behavior?: {
    hooks: string[];
    stateSummary?: string[];
    effects?: string[];
    eventHandlers?: string[];
    hasSideEffects?: boolean;
  };

  structure?: {
    sections?: string[];
    conditionalRenders?: string[];
    repeatedBlocks?: string[];
    jsxDepth?: number;
  };

  style?: {
    system?: "tailwind" | "css-modules" | "styled-components" | "inline-style" | "unknown";
    summary?: string[];
    hasStyleBranching?: boolean;
  };

  snippets?: Array<{
    label: string;
    code: string;
    reason: string;
  }>;

  rawText?: string;

  meta: {
    lineCount: number;
    importCount: number;
    complexityScore?: number;
    generatedAt: string;
  };
};
```

### 스키마 원칙

- core 결과는 adapter와 독립적이어야 한다
- 런타임별 포맷 변환은 adapter 책임이다
- 최소 공통 필드는 일관되게 유지되어야 한다

---

## 13. 판단 로직 요구사항

Mode Decide는 규칙 기반으로 먼저 구현한다.  
PHASE 1에서는 복잡한 ML/학습 기반 접근을 사용하지 않는다.

### 입력 신호

- line count
- JSX depth
- conditional branches
- event handler count
- hooks usage count
- import complexity
- style branching
- 반복 마크업 존재 여부

### 예시 정책

- 작은 파일 + 단순 구조 → raw
- 큰 파일 + 보일러플레이트 비중 높음 → compressed
- 복잡한 분기/행동/이벤트 포함 → hybrid

### 요구사항

- 동일 파일에 대해 안정적인 결과를 제공해야 한다
- 지나친 compressed 편향을 피해야 한다
- mode 선택 근거를 디버깅 가능하게 남길 수 있어야 한다

---

## 14. 기술 구조

## 14-1. Core Engine

공통 본체는 아래 책임을 가진다.

- scan
- extract
- decide
- cache
- schema

## 14-2. Adapter Layer

도구별 연결부는 아래 책임을 가진다.

- Claude adapter
- Codex adapter
- 이후 OMC / OMX adapter

## 14-3. Shared Cache

프로젝트 단위 공통 캐시는 아래를 저장한다.

- file hash
- extract result
- index data

### 구조 원칙

- core는 런타임 무관
- adapter는 연결 전용
- cache는 프로젝트 단위로 재사용 가능

---

## 15. 디렉토리 구조 초안

```txt
fxxks/
  src/
    core/
      scan/
      extract/
      decide/
      cache/
      schema/
    adapters/
      claude/
      codex/
      omc/
      omx/
    cli/
      init.ts
      scan.ts
      extract.ts
      decide.ts
      attach.ts
  .fe-lens/
    cache/
    index.json
    config.json
```

---

## 16. CLI 요구사항

### 제공 명령

```bash
fxxks init
fxxks scan
fxxks extract <file> --json
fxxks decide <file>
fxxks attach claude
fxxks attach codex
```

### 명령별 목적

- `init`: 프로젝트 초기 설정 파일 생성
- `scan`: 프로젝트 인덱스/캐시 생성
- `extract`: 특정 파일 압축 결과 확인
- `decide`: 출력 모드 결정 확인
- `attach`: 특정 런타임 연결부 설치

### PHASE 1 CLI 원칙

- 명령은 단순해야 한다
- core 품질 검증이 adapter 없이 가능해야 한다
- JSON 기반 결과 확인이 쉬워야 한다

---

## 17. 비기능 요구사항

## 17-1. 성능

- scan은 프로젝트 단위로 재사용 가능한 캐시를 생성해야 한다
- 변경되지 않은 파일은 file hash 기반으로 재분석을 최소화해야 한다
- extract/decide는 반복 실행 시 빠르게 응답해야 한다

## 17-2. 품질

- 압축 결과는 프론트엔드 의미 정보를 보존해야 한다
- props/hooks/구조 정보 누락이 과도하면 안 된다
- 작은 파일에서는 raw 유지가 가능해야 한다

## 17-3. 확장성

- core schema는 adapter 교체와 무관해야 한다
- 새로운 런타임 adapter 추가 시 core 수정이 최소화되어야 한다

## 17-4. 로컬 우선

- PHASE 1은 로컬 엔진으로 동작해야 한다
- 외부 서비스 의존 없이 scan/extract/decide 가능해야 한다

---

## 18. 성공 지표

## 18-1. 기능 성공 기준

- 프론트엔드 파일에 대해 raw/compressed/hybrid 판단이 동작한다
- scan/index/cache가 정상 동작한다
- adapter가 core 결과를 런타임에 연결할 수 있다

## 18-2. 사용자 체감 성공 기준

- 긴 TSX 파일 읽기 비용이 줄어든다
- 속도 체감이 크게 나빠지지 않는다
- 압축 때문에 AI 품질이 심하게 깨지지 않는다

## 18-3. 구조 성공 기준

- Claude/Codex 외 런타임에도 붙일 수 있는 구조가 유지된다
- core가 특정 툴 포맷에 종속되지 않는다

---

## 19. 측정 지표 제안

PHASE 1 검증을 위해 아래를 측정한다.

### 정량 지표

- 파일별 입력 토큰 감소율
- 평균 extract 응답 시간
- scan 이후 재실행 캐시 적중률
- raw / compressed / hybrid 비율

### 정성 지표

- 동일 작업에서 AI 응답 품질 유지 여부
- 개발자가 “원문이 꼭 필요했다”고 느끼는 빈도
- hybrid가 필요한 파일 분류 정확성

### 권장 목표 예시

- 긴 TSX 파일에서 유의미한 토큰 절감
- 품질 저하로 인한 fallback 요구 빈도 최소화
- adapter 도입 후 core 수정 없이 attach 가능

---

## 20. 리스크 및 대응

### 리스크 1. 과도한 압축으로 품질 저하

**대응:** raw/hybrid를 적극 허용하고, 무조건 compressed로 가지 않는다.

### 리스크 2. 스타일 정보 누락으로 UI 수정 품질 저하

**대응:** PHASE 1에서는 style summary를 최소 보존하고, 레이아웃/visibility 핵심 정보는 유지한다.

### 리스크 3. 런타임별 포맷 차이로 core가 오염됨

**대응:** 공통 schema 유지, adapter가 변환 책임을 가진다.

### 리스크 4. scan 비용이 초기 체감 성능을 해칠 수 있음

**대응:** project-shared cache와 file hash 기반 증분 처리 설계.

---

## 21. 향후 확장 포인트

이는 PHASE 1 구현 범위는 아니지만 자연스러운 다음 단계다.

### PHASE 2

- OMC / OMX adapter
- related component graph
- 더 똑똑한 fallback

### PHASE 3

- lint mode
- migration mode
- diagnostic-aware context
- 타입 중심 분석 강화

즉 PHASE 1은 기능 확장이 아니라, **확장 가능한 바닥 공사**를 만드는 단계다.

---

## 22. 출시 판단 기준

아래를 만족하면 PHASE 1 MVP 출시 가능으로 본다.

1. React/TSX 파일 대상 scan/extract/decide가 end-to-end로 동작한다.
2. 긴 파일에서 compressed 또는 hybrid 결과가 유의미한 토큰 절감 효과를 보인다.
3. 작은 파일은 raw 유지가 가능하다.
4. Claude/Codex 계열 중 최소 1~2개 attach 경로가 성립한다.
5. core가 adapter 포맷에 오염되지 않는다.

---

## 23. 최종 요약

**PHASE 1 MVP는 React/TSX 프론트엔드 파일 읽기 비용을 줄이는 전용 엔진으로 시작하되, 내부 구조는 OMC/OMX/Claude/Codex 등 여러 런타임에 attach 가능한 공통 core + adapter 방식으로 설계한다.**
