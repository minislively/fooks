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

function run(args, cwd = repoRoot, envOverrides = {}) {
  return JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...envOverrides } }));
}

function makeTempProject(repositoryUrl = "https://github.com/minislively/temp-project.git") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src", "ts-linked"), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), path.join(tempDir, "src", "components", "SimpleButton.tsx"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), path.join(tempDir, "src", "components", "FormSection.tsx"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"), path.join(tempDir, "src", "components", "DashboardPanel.tsx"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "ts-linked", "Button.types.ts"), path.join(tempDir, "src", "ts-linked", "Button.types.ts"));
  fs.copyFileSync(path.join(repoRoot, "fixtures", "ts-linked", "FormSection.utils.ts"), path.join(tempDir, "src", "ts-linked", "FormSection.utils.ts"));
  fs.writeFileSync(path.join(tempDir, "src", "date-utils.ts"), "export const formatDate = (value) => value.toISOString();\n");
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
  assert.ok(result.contract.propsSummary.some((item) => item.includes("label")));
  assert.ok(result.style.summary.some((item) => item.includes("tailwind")));
});

test("extract produces compressed output for boilerplate-heavy fixture", () => {
  const result = run(["extract", "fixtures/compressed/FormSection.tsx"]);
  assert.equal(result.mode, "compressed");
  assert.equal(result.style.system, "tailwind");
  assert.ok(result.structure.repeatedBlocks.includes("array-map-render"));
  assert.equal(result.rawText, undefined);
});

test("extract produces hybrid output for complex fixture", () => {
  const result = run(["extract", "fixtures/hybrid/DashboardPanel.tsx"]);
  assert.equal(result.mode, "hybrid");
  assert.ok(result.behavior.hooks.includes("useState"));
  assert.ok(result.behavior.eventHandlers.includes("handleAcknowledge"));
  assert.ok(result.snippets.length >= 1);
});

test("scan indexes component and qualifying linked ts but excludes generic utils", () => {
  const tempDir = makeTempProject();
  const result = run(["scan"], tempDir);
  const filePaths = result.files.map((item) => item.filePath).sort();
  assert.ok(filePaths.includes(path.join("src", "components", "SimpleButton.tsx")));
  assert.ok(filePaths.includes(path.join("src", "ts-linked", "Button.types.ts")));
  assert.ok(filePaths.includes(path.join("src", "ts-linked", "FormSection.utils.ts")));
  assert.ok(!filePaths.includes(path.join("src", "date-utils.ts")));
  assert.ok(fs.existsSync(path.join(tempDir, ".fe-lens", "index.json")));
  assert.ok(result.refreshedEntries >= 5);

  const secondRun = run(["scan"], tempDir);
  assert.ok(secondRun.reusedCacheEntries >= 5);
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
