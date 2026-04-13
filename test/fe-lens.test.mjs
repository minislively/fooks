import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const cli = path.join(repoRoot, "dist", "cli", "index.js");
const require = createRequire(import.meta.url);
const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const { toModelFacingPayload } = require(path.join(repoRoot, "dist", "core", "payload", "model-facing.js"));
const { assessPayloadReadiness } = require(path.join(repoRoot, "dist", "core", "payload", "readiness.js"));
const { decideCodexPreRead } = require(path.join(repoRoot, "dist", "adapters", "codex-pre-read.js"));
const {
  extractPromptTarget,
  hasFullReadEscapeHatch,
} = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-prompt.js"));
const {
  codexRuntimeSessionPath,
} = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-session.js"));
const { handleCodexRuntimeHook } = require(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));
const { handleCodexNativeHookPayload } = require(path.join(repoRoot, "dist", "adapters", "codex-native-hook.js"));

function run(args, cwd = repoRoot, envOverrides = {}) {
  return JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...envOverrides } }));
}

function runText(args, cwd = repoRoot, envOverrides = {}) {
  return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...envOverrides } });
}

function runTextWithInput(args, input, cwd = repoRoot, envOverrides = {}) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    input,
    env: { ...process.env, ...envOverrides },
  });
}

function makeTempProject(repositoryUrl = "https://github.com/minislively/temp-project.git") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), path.join(tempDir, "src", "components", "SimpleButton.tsx"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "raw", "Button.types.ts"), path.join(tempDir, "src", "components", "Button.types.ts"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), path.join(tempDir, "src", "components", "FormSection.tsx"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "Button.types.ts"), path.join(tempDir, "src", "components", "Button.types.ts"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.utils.ts"), path.join(tempDir, "src", "components", "FormSection.utils.ts"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"), path.join(tempDir, "src", "components", "DashboardPanel.tsx"));
  fs.writeFileSync(path.join(tempDir, "src", "date-utils.ts"), "export const formatDate = (value) => value.toISOString();\n");
  fs.writeFileSync(
    path.join(tempDir, "src", "components", "DateBadge.tsx"),
    [
      'import React from "react";',
      'import { formatDate } from "../date-utils";',
      "",
      "export function DateBadge({ value }: { value: Date }) {",
      '  return <span>{formatDate(value)}</span>;',
      "}",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "temp-project", repository: { url: repositoryUrl } }, null, 2));
  return tempDir;
}

function reductionMetrics(filePath) {
  const result = extractFile(path.resolve(filePath));
  const source = fs.readFileSync(filePath, "utf8");
  const sourceBytes = Buffer.byteLength(source, "utf8");
  const resultBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
  return {
    mode: result.mode,
    reductionPct: (1 - resultBytes / sourceBytes) * 100,
  };
}

function modelPayloadReductionMetrics(filePath, cwd = repoRoot) {
  const result = extractFile(path.resolve(filePath));
  const payload = toModelFacingPayload(result, cwd);
  const fullBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  return {
    mode: result.mode,
    fullBytes,
    payloadBytes,
    reductionPct: (1 - payloadBytes / fullBytes) * 100,
    payload,
  };
}

function runtimeManifestPath(result) {
  const detail = result.runtimeProof.details.find((item) => item.startsWith("runtime-manifest="));
  return detail ? detail.slice("runtime-manifest=".length) : result.runtimeProof.artifactPath;
}

function appendMarker(filePath, marker) {
  const source = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, `${source.trimEnd()}\n${marker}\n`);
}

test("init creates config and cache contract", () => {
  const tempDir = makeTempProject();
  const result = run(["init"], tempDir);
  assert.ok(result.config.endsWith(path.join(".fe-lens", "config.json")));
  assert.ok(result.cacheDir.endsWith(path.join(".fe-lens", "cache")));
  assert.ok(fs.existsSync(path.join(tempDir, ".fe-lens", "config.json")));
  const config = JSON.parse(fs.readFileSync(path.join(tempDir, ".fe-lens", "config.json"), "utf8"));
  assert.equal(config.targetAccount, "minislively");
});

test("extract keeps small fixture raw", () => {
  const result = run(["extract", "fixtures/raw/SimpleButton.tsx"]);
  assert.equal(result.mode, "raw");
  assert.equal(result.componentName, "SimpleButton");
  assert.ok(result.rawText.includes("button"));
  assert.ok(result.fileHash);
  assert.ok(result.meta.generatedAt);
  assert.equal(result.meta.decideConfidence, "high");
  assert.ok(result.contract.propsSummary.some((item) => item.includes("label")));
  assert.ok(result.style.summary.some((item) => item.includes("tailwind")));
});

test("extract can return model-facing payload without engine metadata", () => {
  const result = run(["extract", "fixtures/compressed/FormSection.tsx", "--model-payload"]);
  assert.equal(result.mode, "compressed");
  assert.equal(result.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.equal("fileHash" in result, false);
  assert.equal("meta" in result, false);
  assert.equal("rawText" in result, false);
  assert.equal(result.componentName, "FormSection");
  assert.ok(result.contract.propsSummary.some((item) => item.includes("fields")));
  assert.deepEqual(result.behavior.hooks, []);
  assert.ok(result.structure.sections.includes("section"));
  assert.ok(result.structure.repeatedBlocks.includes("array-map-render"));
  assert.equal(result.style.system, "tailwind");
});

test("extract produces compressed output for boilerplate-heavy fixture", () => {
  const result = run(["extract", "fixtures/compressed/FormSection.tsx"]);
  assert.equal(result.mode, "compressed");
  assert.ok(["medium", "high"].includes(result.meta.decideConfidence));
  assert.equal(result.style.system, "tailwind");
  assert.ok(result.structure.repeatedBlocks.includes("array-map-render"));
  assert.equal(result.rawText, undefined);
});

test("extract produces hybrid output for complex fixture", () => {
  const result = run(["extract", "fixtures/hybrid/DashboardPanel.tsx"]);
  assert.equal(result.mode, "hybrid");
  assert.ok(["medium", "high"].includes(result.meta.decideConfidence));
  assert.ok(result.behavior.hooks.includes("useState"));
  assert.ok(result.behavior.eventHandlers.includes("handleAcknowledge"));
  assert.ok(result.snippets.length >= 1);
});

test("model-facing payload keeps hybrid snippets and prunes unknown style noise", () => {
  const fullResult = extractFile(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"));
  const payload = toModelFacingPayload(fullResult, repoRoot);
  assert.equal(payload.mode, "hybrid");
  assert.equal(payload.filePath, path.join("fixtures", "hybrid", "DashboardPanel.tsx"));
  assert.ok(payload.snippets.length >= 1);
  assert.equal("fileHash" in payload, false);
  assert.equal("meta" in payload, false);
  assert.ok(payload.behavior.eventHandlers.includes("handleAcknowledge"));
  assert.ok(payload.structure.conditionalRenders.length >= 1);
});

test("readiness helper uses stable reasons and ignores debug metadata", () => {
  const compressed = extractFile(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"));
  const compressedPayload = toModelFacingPayload(compressed, repoRoot);
  const compressedReadiness = assessPayloadReadiness(compressed, compressedPayload);
  assert.equal(compressedReadiness.ready, true);
  assert.deepEqual(compressedReadiness.reasons, []);

  const raw = extractFile(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"));
  const rawPayload = toModelFacingPayload(raw, repoRoot);
  const rawReadiness = assessPayloadReadiness(raw, rawPayload);
  assert.equal(rawReadiness.ready, false);
  assert.ok(rawReadiness.reasons.includes("raw-mode"));

  const missingContract = assessPayloadReadiness(compressed, { ...compressedPayload, contract: undefined });
  assert.ok(missingContract.reasons.includes("missing-contract"));

  const missingBehavior = assessPayloadReadiness(compressed, { ...compressedPayload, behavior: undefined });
  assert.ok(missingBehavior.reasons.includes("missing-behavior"));

  const missingStructure = assessPayloadReadiness(compressed, { ...compressedPayload, structure: undefined });
  assert.ok(missingStructure.reasons.includes("missing-structure"));

  const hybrid = extractFile(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"));
  const hybridPayload = toModelFacingPayload(hybrid, repoRoot);
  const missingSnippets = assessPayloadReadiness(hybrid, { ...hybridPayload, snippets: undefined });
  assert.ok(missingSnippets.reasons.includes("missing-hybrid-snippets"));

  assert.equal(compressedReadiness.signals.usedComplexityScore, false);
  assert.equal(compressedReadiness.signals.usedDecideReason, false);
});

test("codex pre-read chooses payload for eligible tsx/jsx and fallback otherwise", () => {
  const compressed = decideCodexPreRead(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), repoRoot);
  assert.equal(compressed.eligible, true);
  assert.equal(compressed.decision, "payload");
  assert.equal(compressed.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.ok(compressed.payload);
  assert.ok(["low", "medium", "high"].includes(compressed.debug.decideConfidence));

  const hybrid = decideCodexPreRead(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"), repoRoot);
  assert.equal(hybrid.decision, "payload");
  assert.ok(hybrid.payload.snippets?.length);
  assert.ok(["medium", "high"].includes(hybrid.debug.decideConfidence));

  const jsx = decideCodexPreRead(path.join(repoRoot, "fixtures", "jsx", "SimpleWidget.jsx"), repoRoot);
  assert.equal(jsx.eligible, true);
  assert.equal(jsx.decision, "payload");
  assert.equal(jsx.filePath, path.join("fixtures", "jsx", "SimpleWidget.jsx"));
  assert.ok(jsx.payload.contract);

  const raw = decideCodexPreRead(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), repoRoot);
  assert.equal(raw.eligible, true);
  assert.equal(raw.decision, "fallback");
  assert.ok(raw.reasons.includes("raw-mode"));
  assert.equal(raw.fallback.reason, "raw-mode");

  const linkedTs = decideCodexPreRead(path.join(repoRoot, "fixtures", "ts-linked", "Button.types.ts"), repoRoot);
  assert.equal(linkedTs.eligible, false);
  assert.equal(linkedTs.decision, "fallback");
  assert.ok(linkedTs.reasons.includes("ineligible-extension"));
  assert.equal(linkedTs.filePath, path.join("fixtures", "ts-linked", "Button.types.ts"));
});

test("cli codex-pre-read reuses the same decision seam and advertises the command", () => {
  const cliPayload = run(["codex-pre-read", "fixtures/compressed/FormSection.tsx"]);
  const directPayload = decideCodexPreRead(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), repoRoot);
  assert.deepEqual(cliPayload, directPayload);

  const cliJsx = run(["codex-pre-read", "fixtures/jsx/SimpleWidget.jsx"]);
  const directJsx = decideCodexPreRead(path.join(repoRoot, "fixtures", "jsx", "SimpleWidget.jsx"), repoRoot);
  assert.deepEqual(cliJsx, directJsx);

  const cliFallback = run(["codex-pre-read", "fixtures/raw/SimpleButton.tsx"]);
  assert.equal(cliFallback.decision, "fallback");
  assert.ok(cliFallback.reasons.includes("raw-mode"));

  let usage = "";
  try {
    runText(["unknown-command"]);
  } catch (error) {
    usage = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(usage, /codex-pre-read/);
});

test("runtime prompt parser finds eligible tsx/jsx paths and escape hatches", () => {
  const tsxTarget = extractPromptTarget("Please update components/QuestionAnswerForm.tsx for this flow", path.join(repoRoot, "..", "ai-job-finder"));
  assert.equal(tsxTarget, path.join("components", "QuestionAnswerForm.tsx"));

  const jsxTarget = extractPromptTarget("Review fixtures/jsx/SimpleWidget.jsx for repeated work", repoRoot);
  assert.equal(jsxTarget, path.join("fixtures", "jsx", "SimpleWidget.jsx"));

  const tsTarget = extractPromptTarget("Check fixtures/ts-linked/Button.types.ts too", repoRoot);
  assert.equal(tsTarget, null);

  assert.equal(hasFullReadEscapeHatch("Need exact source #fxxks-full-read"), true);
  assert.equal(hasFullReadEscapeHatch("Need exact source #fxxks-disable-pre-read"), true);
  assert.equal(hasFullReadEscapeHatch("No override here"), false);
});

test("runtime hook reuses payload only on repeated same-file prompts in one session", () => {
  const sessionId = `hook-repeat-${Date.now()}`;
  const start = handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId }, repoRoot);
  assert.equal(start.action, "noop");
  assert.ok(fs.existsSync(codexRuntimeSessionPath(repoRoot, sessionId)));

  const first = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  assert.equal(first.action, "record");
  assert.equal(first.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.equal(first.additionalContext, undefined);

  const second = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId,
      prompt: "Again, update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  assert.equal(second.action, "inject");
  assert.equal(second.filePath, path.join("fixtures", "compressed", "FormSection.tsx"));
  assert.ok(
    second.additionalContext.startsWith(
      `fxxks: reused pre-read (compressed) · file: ${path.join("fixtures", "compressed", "FormSection.tsx")}`,
    ),
  );
  assert.ok(second.additionalContext.includes("#fxxks-full-read"));
  assert.equal(second.debug.repeatedFile, true);
});

test("runtime hook falls back for escape hatch and raw readiness failures", () => {
  const rawSession = `hook-raw-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: rawSession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: rawSession,
      prompt: "Review fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );
  const rawSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: rawSession,
      prompt: "Again, review fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );
  assert.equal(rawSecond.action, "fallback");
  assert.ok(rawSecond.reasons.includes("raw-mode"));
  assert.equal(rawSecond.fallback.reason, "raw-mode");

  const overrideSession = `hook-override-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: overrideSession }, repoRoot);
  const overridden = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: overrideSession,
      prompt: "Please inspect fixtures/compressed/FormSection.tsx #fxxks-full-read",
    },
    repoRoot,
  );
  assert.equal(overridden.action, "fallback");
  assert.ok(overridden.reasons.includes("escape-hatch-full-read"));
  assert.equal(overridden.fallback.reason, "escape-hatch-full-read");
  assert.equal(overridden.debug.escapeHatchUsed, true);
});

test("runtime hook supports jsx repeated prompts and ignores linked ts prompts", () => {
  const jsxSession = `hook-jsx-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: jsxSession }, repoRoot);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: jsxSession,
      prompt: "Check fixtures/jsx/SimpleWidget.jsx",
    },
    repoRoot,
  );
  const jsxSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: jsxSession,
      prompt: "Again, check fixtures/jsx/SimpleWidget.jsx",
    },
    repoRoot,
  );
  assert.equal(jsxSecond.action, "inject");
  assert.equal(jsxSecond.filePath, path.join("fixtures", "jsx", "SimpleWidget.jsx"));

  const tsSession = `hook-ts-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: tsSession }, repoRoot);
  const tsPrompt = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: tsSession,
      prompt: "Check fixtures/ts-linked/Button.types.ts",
    },
    repoRoot,
  );
  assert.equal(tsPrompt.action, "noop");
  assert.ok(tsPrompt.reasons.includes("no-eligible-file-in-prompt"));
});

test("cli codex-runtime-hook reuses runtime decision logic and advertises the command", () => {
  const cliStartSession = `cli-hook-start-${Date.now()}`;
  const directStartSession = `${cliStartSession}-direct`;
  const cliStart = run(["codex-runtime-hook", "--event", "SessionStart", "--session-id", cliStartSession]);
  const directStart = handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: directStartSession }, repoRoot);
  directStart.statePath = cliStart.statePath;
  assert.deepEqual(cliStart, directStart);

  const cliFirstSession = `cli-hook-first-${Date.now()}`;
  const directFirstSession = `${cliFirstSession}-direct`;
  run(["codex-runtime-hook", "--event", "SessionStart", "--session-id", cliFirstSession]);
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: directFirstSession }, repoRoot);
  const cliFirst = run([
    "codex-runtime-hook",
    "--event",
    "UserPromptSubmit",
    "--session-id",
    cliFirstSession,
    "--prompt",
    "Please update fixtures/compressed/FormSection.tsx",
  ]);
  const directFirst = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: directFirstSession,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  directFirst.statePath = cliFirst.statePath;
  assert.deepEqual(cliFirst, directFirst);

  const cliSecondSession = `cli-hook-second-${Date.now()}`;
  const directSecondSession = `${cliSecondSession}-direct`;
  run(["codex-runtime-hook", "--event", "SessionStart", "--session-id", cliSecondSession]);
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: directSecondSession }, repoRoot);
  run([
    "codex-runtime-hook",
    "--event",
    "UserPromptSubmit",
    "--session-id",
    cliSecondSession,
    "--prompt",
    "Please update fixtures/compressed/FormSection.tsx",
  ]);
  handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: directSecondSession,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  const cliSecond = run([
    "codex-runtime-hook",
    "--event",
    "UserPromptSubmit",
    "--session-id",
    cliSecondSession,
    "--prompt",
    "Again, update fixtures/compressed/FormSection.tsx",
  ]);
  const directSecond = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: directSecondSession,
      prompt: "Again, update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  directSecond.statePath = cliSecond.statePath;
  assert.deepEqual(cliSecond, directSecond);

  let usage = "";
  try {
    runText(["unknown-command"]);
  } catch (error) {
    usage = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.match(usage, /codex-runtime-hook/);
});

test("native hook bridge only activates inside attached codex projects", () => {
  const tempDir = makeTempProject();
  const detachedOutput = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: tempDir,
      prompt: "Please update src/components/FormSection.tsx",
      session_id: `native-detached-${Date.now()}`,
    },
    tempDir,
  );
  assert.equal(detachedOutput, null);

  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FE_LENS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-")) });

  const sessionId = `native-attached-${Date.now()}`;
  const first = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Please update src/components/FormSection.tsx",
      session_id: sessionId,
    },
    attachedDir,
  );
  assert.equal(first, null);

  const second = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Again, update src/components/FormSection.tsx",
      session_id: sessionId,
    },
    attachedDir,
  );
  assert.equal(second.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(
    second.hookSpecificOutput.additionalContext,
    /fxxks: reused pre-read \(compressed\) · file: src\/components\/FormSection\.tsx/,
  );
});

test("native hook bridge emits full-read guidance for repeated fallback cases", () => {
  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FE_LENS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-")) });

  const sessionId = `native-fallback-${Date.now()}`;
  handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Please inspect src/components/SimpleButton.tsx",
      session_id: sessionId,
    },
    attachedDir,
  );
  const fallback = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Again, inspect src/components/SimpleButton.tsx",
      session_id: sessionId,
    },
    attachedDir,
  );
  assert.equal(fallback.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(
    fallback.hookSpecificOutput.additionalContext,
    /fxxks: fallback \(raw-mode\) · file: src\/components\/SimpleButton\.tsx · Read the full source file for this turn\./,
  );
});

test("native hook bridge uses fixed full-read status vocabulary for escape hatch overrides", () => {
  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FE_LENS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-")) });

  const overridden = handleCodexNativeHookPayload(
    {
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Need exact source src/components/FormSection.tsx #fxxks-full-read",
      session_id: `native-escape-${Date.now()}`,
    },
    attachedDir,
  );
  assert.equal(overridden.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(
    overridden.hookSpecificOutput.additionalContext,
    /^fxxks: full read requested · file: src\/components\/FormSection\.tsx · Read the full source file for this turn\.$/,
  );
  assert.doesNotMatch(overridden.hookSpecificOutput.additionalContext, /fallback \(/);
});

test("cli codex-runtime-hook can read native hook payloads from stdin", () => {
  const attachedDir = makeTempProject();
  run(["attach", "codex"], attachedDir, { FE_LENS_CODEX_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-")) });

  const sessionId = `cli-native-${Date.now()}`;
  runTextWithInput(
    ["codex-runtime-hook", "--native-hook"],
    JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      cwd: attachedDir,
      prompt: "Please update src/components/FormSection.tsx",
      session_id: sessionId,
    }),
    attachedDir,
  );
  const cliSecond = JSON.parse(
    runTextWithInput(
      ["codex-runtime-hook", "--native-hook"],
      JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        cwd: attachedDir,
        prompt: "Again, update src/components/FormSection.tsx",
        session_id: sessionId,
      }),
      attachedDir,
    ),
  );
  assert.equal(cliSecond.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(
    cliSecond.hookSpecificOutput.additionalContext,
    /fxxks: reused pre-read \(compressed\) · file: src\/components\/FormSection\.tsx/,
  );
});

test("scan indexes component and qualifying linked ts but excludes generic utils", () => {
  const tempDir = makeTempProject();
  const result = run(["scan"], tempDir);
  const filePaths = result.files.map((item) => item.filePath).sort();
  assert.ok(filePaths.includes(path.join("src", "components", "SimpleButton.tsx")));
  assert.ok(filePaths.includes(path.join("src", "components", "Button.types.ts")));
  assert.ok(filePaths.includes(path.join("src", "components", "FormSection.utils.ts")));
  assert.ok(!filePaths.includes(path.join("src", "date-utils.ts")));
  assert.ok(fs.existsSync(path.join(tempDir, ".fe-lens", "index.json")));
  assert.ok(result.refreshedEntries >= 5);
  const formSectionEntry = result.files.find((item) => item.filePath === path.join("src", "components", "FormSection.tsx"));
  assert.ok(formSectionEntry);
  assert.equal(typeof formSectionEntry.complexityScore, "number");
  assert.ok(Array.isArray(formSectionEntry.decideReason));
  assert.ok(["low", "medium", "high"].includes(formSectionEntry.decideConfidence));

  const secondRun = run(["scan"], tempDir);
  assert.ok(secondRun.reusedCacheEntries >= 5);
});

test("scan excludes cross-folder linked ts even when directly imported", () => {
  const tempDir = makeTempProject();
  const result = run(["scan"], tempDir);
  const filePaths = result.files.map((item) => item.filePath);
  assert.ok(filePaths.includes(path.join("src", "components", "DateBadge.tsx")));
  assert.ok(!filePaths.includes(path.join("src", "date-utils.ts")));
});

test("scan only refreshes changed files after cache warm-up", () => {
  const tempDir = makeTempProject();
  const firstScan = run(["scan"], tempDir);
  assert.ok(firstScan.refreshedEntries >= 5);

  const changedFile = path.join(tempDir, "src", "components", "FormSection.tsx");
  appendMarker(changedFile, "// cache-invalidation-marker");

  const secondScan = run(["scan"], tempDir);
  assert.equal(secondScan.refreshedEntries, 1);
  assert.equal(secondScan.reusedCacheEntries, firstScan.files.length - 1);

  const indexEntry = secondScan.files.find((item) => item.filePath === path.join("src", "components", "FormSection.tsx"));
  assert.ok(indexEntry);
  assert.notEqual(indexEntry.fileHash, firstScan.files.find((item) => item.filePath === indexEntry.filePath).fileHash);
});

test("value-proof gate shows >=25% reduction on two long fixtures", () => {
  const compressed = reductionMetrics(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"));
  const hybrid = reductionMetrics(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"));
  assert.equal(compressed.mode, "compressed");
  assert.equal(hybrid.mode, "hybrid");
  assert.ok(compressed.reductionPct >= 25, `expected compressed reduction >= 25%, received ${compressed.reductionPct.toFixed(2)}%`);
  assert.ok(hybrid.reductionPct >= 25, `expected hybrid reduction >= 25%, received ${hybrid.reductionPct.toFixed(2)}%`);
});

test("model-facing payload trim hits >=15% reduction on at least two compressed/hybrid samples", () => {
  const tempDir = makeTempProject();
  const candidates = [
    modelPayloadReductionMetrics(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx")),
    modelPayloadReductionMetrics(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx")),
    modelPayloadReductionMetrics(path.join(tempDir, "src", "components", "DashboardPanel.tsx"), tempDir),
  ];

  const qualifying = candidates.filter((item) => item.mode !== "raw" && item.reductionPct >= 15);
  assert.ok(
    qualifying.length >= 2,
    `expected >=2 qualifying reductions, received ${qualifying.map((item) => item.reductionPct.toFixed(2)).join(", ")}`,
  );

  for (const candidate of candidates.filter((item) => item.mode !== "raw")) {
    assert.ok(candidate.payload.contract);
    assert.ok(candidate.payload.behavior);
    assert.ok(candidate.payload.structure);
    if (candidate.mode === "hybrid") {
      assert.ok(candidate.payload.snippets?.length);
    }
  }
});



test("install codex-hooks creates a reusable hooks preset", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-"));
  const result = run(["install", "codex-hooks"], repoRoot, { FE_LENS_CODEX_HOME: codexHome });
  assert.equal(result.created, true);
  assert.equal(result.modified, true);
  assert.deepEqual(result.installedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  const hooks = JSON.parse(fs.readFileSync(path.join(codexHome, "hooks.json"), "utf8"));
  assert.equal(hooks.hooks.SessionStart[0].hooks[0].command, "fxxks codex-runtime-hook --native-hook");
  assert.equal(hooks.hooks.UserPromptSubmit[0].hooks[0].command, "fxxks codex-runtime-hook --native-hook");
  assert.equal(hooks.hooks.Stop[0].hooks[0].command, "fxxks codex-runtime-hook --native-hook");
});

test("install codex-hooks merges without clobbering existing hooks and stays idempotent", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-"));
  const hooksPath = path.join(codexHome, "hooks.json");
  fs.writeFileSync(hooksPath, JSON.stringify({
    hooks: {
      SessionStart: [{ matcher: "startup|resume", hooks: [{ type: "command", command: "node /tmp/omx-start.js", statusMessage: "Loading OMX session context" }] }],
      UserPromptSubmit: [{ hooks: [{ type: "command", command: "node /tmp/omx.js", statusMessage: "Applying OMX prompt routing" }] }],
      Stop: [{ hooks: [{ type: "command", command: "node /tmp/omx-stop.js" }] }],
    },
  }, null, 2));

  const first = run(["install", "codex-hooks"], repoRoot, { FE_LENS_CODEX_HOME: codexHome });
  assert.equal(first.created, false);
  assert.equal(first.modified, true);
  assert.equal(first.installedEvents.length, 3);
  assert.ok(first.backupPath);

  const merged = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  assert.equal(merged.hooks.SessionStart.length, 2);
  assert.equal(merged.hooks.SessionStart[0].hooks[0].command, "fxxks codex-runtime-hook --native-hook");
  assert.equal(merged.hooks.SessionStart[1].hooks[0].command, "node /tmp/omx-start.js");
  assert.equal(merged.hooks.UserPromptSubmit[0].hooks[0].command, "fxxks codex-runtime-hook --native-hook");
  assert.equal(merged.hooks.UserPromptSubmit[1].hooks[0].command, "node /tmp/omx.js");
  assert.equal(merged.hooks.Stop[0].hooks[0].command, "fxxks codex-runtime-hook --native-hook");
  assert.equal(merged.hooks.Stop[1].hooks[0].command, "node /tmp/omx-stop.js");

  const second = run(["install", "codex-hooks"], repoRoot, { FE_LENS_CODEX_HOME: codexHome });
  assert.equal(second.modified, false);
  assert.deepEqual(second.skippedEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
});

test("attach codex proves contract and runtime under minislively account context", () => {
  const tempDir = makeTempProject();
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-"));
  const result = run(["attach", "codex"], tempDir, { FE_LENS_CODEX_HOME: codexHome });
  assert.equal(result.runtime, "codex");
  assert.equal(result.contractProof.passed, true);
  assert.equal(result.runtimeProof.status, "passed");
  assert.ok(result.runtimeProof.attemptedAt);
  assert.ok(result.filesCreated.some((item) => item.includes("adapter.json")));
  assert.ok(!fs.existsSync(path.join(tempDir, "fixtures")));
  assert.ok(result.runtimeProof.details.some((item) => item.includes("runtime-manifest=")));
  assert.ok(result.runtimeProof.details.some((item) => item.includes("account-source=")));
  assert.ok(fs.existsSync(runtimeManifestPath(result)));
  const runtimeManifest = JSON.parse(fs.readFileSync(runtimeManifestPath(result), "utf8"));
  assert.equal(runtimeManifest.runtimeBridge.command, "fxxks codex-runtime-hook --native-hook");
  assert.deepEqual(runtimeManifest.runtimeBridge.supportedHookEvents, ["SessionStart", "UserPromptSubmit", "Stop"]);
  assert.ok(runtimeManifest.runtimeBridge.escapeHatches.includes("#fxxks-full-read"));
});

test("attach claude can report blocker without failing contract proof", () => {
  const tempDir = makeTempProject();
  const result = run(["attach", "claude"], tempDir, { FE_LENS_CLAUDE_HOME: path.join(tempDir, ".missing-claude-home") });
  assert.equal(result.runtime, "claude");
  assert.equal(result.contractProof.passed, true);
  assert.equal(result.runtimeProof.status, "blocked");
  assert.ok(result.runtimeProof.attemptedAt);
  assert.ok(result.runtimeProof.blocker);
});

test("attach can use explicit active account override instead of repository metadata", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-"));
  const result = run(["attach", "codex"], tempDir, {
    FE_LENS_ACTIVE_ACCOUNT: "minislively",
    FE_LENS_CODEX_HOME: codexHome,
  });
  assert.equal(result.runtimeProof.status, "passed");
  assert.ok(result.runtimeProof.details.includes("account-source=env"));
});

test("attach codex blocks non-minislively account without writing runtime manifest", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-codex-home-"));
  const result = run(["attach", "codex"], tempDir, { FE_LENS_CODEX_HOME: codexHome });
  assert.equal(result.runtimeProof.status, "blocked");
  assert.equal(result.runtimeProof.blocker, "minislively account context not detected");
  assert.ok(result.runtimeProof.details.includes("account-source=package-repository"));
  assert.equal(runtimeManifestPath(result), undefined);
  assert.equal(fs.existsSync(path.join(codexHome, "fe-lens")), false);
});

test("attach claude blocks non-minislively account without writing runtime manifest", () => {
  const tempDir = makeTempProject("https://github.com/example-org/temp-project.git");
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-claude-home-"));
  const result = run(["attach", "claude"], tempDir, { FE_LENS_CLAUDE_HOME: claudeHome });
  assert.equal(result.runtimeProof.status, "blocked");
  assert.equal(result.runtimeProof.blocker, "minislively account context not detected");
  assert.ok(result.runtimeProof.details.includes("account-source=package-repository"));
  assert.equal(runtimeManifestPath(result), undefined);
  assert.equal(fs.existsSync(path.join(claudeHome, "fe-lens")), false);
});
