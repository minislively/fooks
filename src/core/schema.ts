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
