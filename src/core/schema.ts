export type OutputMode = "raw" | "compressed" | "hybrid";
export type Language = "tsx" | "jsx" | "ts";
export type StyleSystem =
  | "tailwind"
  | "css-modules"
  | "styled-components"
  | "inline-style"
  | "unknown";

export type ExtractionResult = {
  filePath: string;
  fileHash: string;
  language: Language;
  mode: OutputMode;
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
    system?: StyleSystem;
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
    decideReason?: string[];
  };
};

export type ModelFacingPayload = {
  mode: OutputMode;
  filePath: string;
  componentName?: string;
  exports?: ExtractionResult["exports"];
  contract?: ExtractionResult["contract"];
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
    system?: StyleSystem;
    summary?: string[];
    hasStyleBranching?: boolean;
  };
  snippets?: ExtractionResult["snippets"];
};

export type PayloadReadiness = {
  ready: boolean;
  reasons: string[];
  signals: {
    mode: ExtractionResult["mode"];
    hasContract: boolean;
    hasBehavior: boolean;
    hasStructure: boolean;
    hasHybridSnippets: boolean;
    usedComplexityScore: false;
    usedDecideReason: false;
  };
};

export type CodexPreReadDecision = {
  runtime: "codex";
  filePath: string;
  eligible: boolean;
  decision: "payload" | "fallback";
  reasons: string[];
  payload?: ModelFacingPayload;
  readiness?: PayloadReadiness;
  debug: {
    mode?: ExtractionResult["mode"];
    complexityScore?: number;
    decideReason?: string[];
    language?: ExtractionResult["language"];
  };
  fallback?: {
    action: "full-read";
    reason: string;
  };
};

export type CodexRuntimeHookEvent = "SessionStart" | "UserPromptSubmit" | "Stop";

export type CodexRuntimeHookInput = {
  hookEventName: CodexRuntimeHookEvent;
  prompt?: string;
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  cwd?: string;
};

export type CodexRuntimeHookDecision = {
  runtime: "codex";
  hookEventName: CodexRuntimeHookEvent;
  action: "noop" | "record" | "inject" | "fallback";
  filePath?: string;
  reasons: string[];
  statePath?: string;
  additionalContext?: string;
  debug?: {
    repeatedFile: boolean;
    eligible: boolean;
    escapeHatchUsed: boolean;
    decision?: CodexPreReadDecision;
  };
  fallback?: {
    action: "full-read";
    reason: string;
  };
};

export type IndexEntry = {
  filePath: string;
  fileHash: string;
  componentName?: string;
  exports: ExtractionResult["exports"];
  propsSummary?: string[];
  hooks: string[];
  styleSystem: StyleSystem;
  mode: OutputMode;
  kind: "component" | "linked-ts";
};

export type ScanResult = {
  projectRoot: string;
  scannedAt: string;
  files: IndexEntry[];
  reusedCacheEntries: number;
  refreshedEntries: number;
};

export type AttachResult = {
  runtime: "codex" | "claude";
  accountContext: string;
  filesCreated: string[];
  contractProof: {
    passed: boolean;
    details: string[];
  };
  runtimeProof: {
    status: "passed" | "blocked";
    details: string[];
    attemptedAt?: string;
    artifactPath?: string;
    blocker?: string;
  };
};
