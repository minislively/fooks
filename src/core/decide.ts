import type { ExtractionResult, OutputMode } from "./schema";

export type DecideMetrics = {
  mode: OutputMode;
  complexityScore: number;
  reasons: string[];
};

export function decideMode(base: Omit<ExtractionResult, "mode">): DecideMetrics {
  const lineCount = base.meta.lineCount;
  const jsxDepth = base.structure?.jsxDepth ?? 0;
  const conditionalCount = base.structure?.conditionalRenders?.length ?? 0;
  const repeatedCount = base.structure?.repeatedBlocks?.length ?? 0;
  const hookCount = base.behavior?.hooks.length ?? 0;
  const handlerCount = base.behavior?.eventHandlers?.length ?? 0;
  const styleBranching = base.style?.hasStyleBranching ? 1 : 0;
  const importCount = base.meta.importCount;

  const complexityScore =
    lineCount * 0.05 +
    jsxDepth * 3 +
    conditionalCount * 8 +
    repeatedCount * 7 +
    hookCount * 4 +
    handlerCount * 3 +
    styleBranching * 6 +
    importCount * 1.2;

  const reasons: string[] = [];
  if (lineCount <= 40) reasons.push("small-file");
  if (jsxDepth <= 3) reasons.push("shallow-jsx");
  if (conditionalCount >= 2) reasons.push("multiple-conditionals");
  if (repeatedCount >= 1) reasons.push("repeated-rendering");
  if (hookCount >= 3) reasons.push("heavy-hook-usage");
  if (handlerCount >= 3) reasons.push("event-heavy");
  if (styleBranching) reasons.push("style-branching");
  if (importCount >= 8) reasons.push("import-heavy");
  if (lineCount >= 120) reasons.push("long-file");

  const isRawCandidate = lineCount <= 45 && jsxDepth <= 3 && conditionalCount <= 1 && hookCount <= 1 && handlerCount <= 1 && !styleBranching;
  const isHybridCandidate = conditionalCount >= 2 || handlerCount >= 3 || hookCount >= 3 || styleBranching === 1;

  if (isRawCandidate) {
    return { mode: "raw", complexityScore, reasons };
  }

  if (isHybridCandidate) {
    return { mode: "hybrid", complexityScore, reasons };
  }

  return { mode: "compressed", complexityScore, reasons };
}
