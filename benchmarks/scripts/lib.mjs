import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { execFileSync, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, "../..");
export const benchmarksRoot = path.join(repoRoot, "benchmarks");
export const resultsRoot = path.join(benchmarksRoot, "results");
export const latestResultsRoot = path.join(resultsRoot, "latest");
export const historyResultsRoot = path.join(resultsRoot, "history");
export const benchmarkVersion = "1.0.0";
export const defaultRepeatCount = 10;
export const defaultFixtureCopyCount = 20;

const require = createRequire(import.meta.url);
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const { extractFile } = require(path.join(repoRoot, "dist", "core", "extract.js"));
const { decideMode } = require(path.join(repoRoot, "dist", "core", "decide.js"));

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values, avg) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function relativeToRepo(filePath) {
  return path.relative(repoRoot, filePath) || path.basename(filePath);
}

export function relativeToCwd(filePath, cwd) {
  return path.relative(cwd, filePath) || path.basename(filePath);
}

export function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

export function resolveRepeatCount() {
  const raw = Number(process.env.FOOKS_BENCH_REPEAT_COUNT ?? defaultRepeatCount);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : defaultRepeatCount;
}

export function resolveFixtureCopyCount() {
  const raw = Number(process.env.FOOKS_BENCH_COPY_COUNT ?? defaultFixtureCopyCount);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : defaultFixtureCopyCount;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadFixtureSet() {
  return readJson(path.join(benchmarksRoot, "fixtures", "phase1-fixtures.json"));
}

export function loadPreservationExpectations() {
  return readJson(path.join(benchmarksRoot, "expected", "preservation.json"));
}

export function loadModeExpectations() {
  return readJson(path.join(benchmarksRoot, "expected", "modes.json"));
}

export function ensureResultsDirs() {
  fs.mkdirSync(latestResultsRoot, { recursive: true });
  fs.mkdirSync(historyResultsRoot, { recursive: true });
}

export function benchmarkMetadata({ runId, fixtureSetVersion }) {
  let gitSha = "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    gitSha = "unknown";
  }

  return {
    benchmarkVersion,
    runId,
    gitSha,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    fixtureSetVersion,
  };
}

export function createEnvelope({ runId, fixtureSetVersion, suites, gates }) {
  return {
    ...benchmarkMetadata({ runId, fixtureSetVersion }),
    suites,
    gates,
  };
}

export function writeResultArtifacts(fileName, payload, runId = payload.runId ?? new Date().toISOString()) {
  ensureResultsDirs();
  const latestPath = path.join(latestResultsRoot, fileName);
  const historyPath = path.join(historyResultsRoot, `${runId.replace(/[:.]/g, "-")}-${fileName}`);
  fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(historyPath, JSON.stringify(payload, null, 2));
  return { latestPath, historyPath };
}

export function summariseNumbers(values) {
  const avg = mean(values);
  return {
    avgMs: round(avg),
    minMs: round(Math.min(...values)),
    maxMs: round(Math.max(...values)),
    stddevMs: round(stddev(values, avg)),
  };
}

export function aggregateScenario(samples) {
  const durations = samples.map((sample) => sample.durationMs);
  const counts = samples[0];
  const summary = summariseNumbers(durations);
  const observability = aggregateObservability(samples.map((sample) => sample.observability).filter(Boolean));
  const runtimeBreakdown = deriveRuntimeBreakdown(summary.avgMs, observability);
  return {
    ...summary,
    fileCount: counts.fileCount,
    changedFileCount: counts.changedFileCount,
    cacheHitCount: counts.cacheHitCount,
    cacheMissCount: counts.cacheMissCount,
    invalidatedFileCount: counts.invalidatedFileCount,
    observability,
    runtimeBreakdown,
  };
}

function aggregateNumericObjects(samples, fallback = {}) {
  if (!samples.length) return fallback;
  const keys = new Set(samples.flatMap((sample) => Object.keys(sample ?? {})));
  return Object.fromEntries(
    [...keys].map((key) => {
      const values = samples.map((sample) => sample?.[key]).filter((value) => typeof value === "number");
      return [key, values.length ? round(mean(values)) : fallback[key]];
    }),
  );
}

function aggregateObservability(samples) {
  if (!samples.length) return undefined;
  return {
    timingsMs: aggregateNumericObjects(samples.map((sample) => sample.timingsMs), {}),
    counters: aggregateNumericObjects(samples.map((sample) => sample.counters), {}),
    discovery: aggregateNumericObjects(samples.map((sample) => sample.discovery), {}),
    slowFiles: samples.find((sample) => Array.isArray(sample.slowFiles) && sample.slowFiles.length)?.slowFiles ?? [],
  };
}

function deriveRuntimeBreakdown(cliWallMs, observability) {
  const scanCoreMs = round(observability?.timingsMs?.total ?? 0);
  const outsideScanMs = round(Math.max(0, cliWallMs - scanCoreMs));
  return {
    cliWallMs: round(cliWallMs),
    scanCoreMs,
    outsideScanMs,
    scanCoreRatio: cliWallMs > 0 ? round(scanCoreMs / cliWallMs, 4) : 0,
    outsideScanRatio: cliWallMs > 0 ? round(outsideScanMs / cliWallMs, 4) : 0,
  };
}

export function runCliJson(args, cwd = repoRoot, envOverrides = {}) {
  return JSON.parse(execFileSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...envOverrides },
  }));
}

export function measure(fn) {
  const startedAt = performance.now();
  const value = fn();
  return {
    durationMs: round(performance.now() - startedAt),
    value,
  };
}

export function makeBenchmarkProject(copyCount = resolveFixtureCopyCount()) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-bench-"));
  const componentsDir = path.join(tempDir, "src", "components");
  fs.mkdirSync(componentsDir, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "fixtures", "compressed", "Button.types.ts"), path.join(componentsDir, "Button.types.ts"));
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "fooks-benchmark",
        repository: { url: "https://github.com/minislively/fooks-benchmark.git" },
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < copyCount; index += 1) {
    const simpleSource = `${fs.readFileSync(path.join(repoRoot, "fixtures", "raw", "SimpleButton.tsx"), "utf8").trimEnd()}\n// benchmark-simple-copy:${index}\n`;
    fs.writeFileSync(path.join(componentsDir, `SimpleButton${index}.tsx`), simpleSource);

    const utilBaseName = `FormSection${index}.utils`;
    const formSource = fs
      .readFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.tsx"), "utf8")
      .replace("./FormSection.utils", `./${utilBaseName}`);
    const utilSource = `${fs.readFileSync(path.join(repoRoot, "fixtures", "compressed", "FormSection.utils.ts"), "utf8").trimEnd()}\n// benchmark-form-util-copy:${index}\n`;
    fs.writeFileSync(path.join(componentsDir, `${utilBaseName}.ts`), utilSource);
    fs.writeFileSync(path.join(componentsDir, `FormSection${index}.tsx`), `${formSource.trimEnd()}\n// benchmark-form-copy:${index}\n`);

    const dashboardSource = `${fs.readFileSync(path.join(repoRoot, "fixtures", "hybrid", "DashboardPanel.tsx"), "utf8").trimEnd()}\n// benchmark-dashboard-copy:${index}\n`;
    fs.writeFileSync(path.join(componentsDir, `DashboardPanel${index}.tsx`), dashboardSource);
  }

  return tempDir;
}

export function appendMarker(filePath, marker) {
  const source = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, `${source.trimEnd()}\n${marker}\n`);
}

export function clearProjectState(cwd) {
  fs.rmSync(path.join(cwd, ".fooks"), { recursive: true, force: true });
}

export function runScanScenario(cwd, changedFileCount = 0, invalidatedFileCount = 0) {
  const { durationMs, value } = measure(() => runCliJson(["scan"], cwd));
  return {
    durationMs,
    fileCount: value.files.length,
    changedFileCount,
    cacheHitCount: value.reusedCacheEntries,
    cacheMissCount: value.refreshedEntries,
    invalidatedFileCount,
    observability: value.observability,
    result: value,
  };
}

export function runScanCacheSuite({ repeatCount = resolveRepeatCount() } = {}) {
  const coldSamples = [];
  const warmSamples = [];
  const partialSingleSamples = [];
  const partialMultiSamples = [];
  const rescanAfterInvalidationSamples = [];
  let totalFiles = 0;
  let kindCounts = { components: 0, linkedTs: 0 };

  for (let index = 0; index < repeatCount; index += 1) {
    const benchmarkProject = makeBenchmarkProject();
    const cold = runScanScenario(benchmarkProject);
    const warm = runScanScenario(benchmarkProject);

    const singleFile = path.join(benchmarkProject, "src", "components", "DashboardPanel7.tsx");
    appendMarker(singleFile, `// benchmark-single-invalidation:${index}`);
    const partialSingle = runScanScenario(benchmarkProject, 1, 1);

    const multiFiles = [
      path.join(benchmarkProject, "src", "components", "FormSection7.tsx"),
      path.join(benchmarkProject, "src", "components", "SimpleButton7.tsx"),
    ];
    multiFiles.forEach((filePath, offset) => appendMarker(filePath, `// benchmark-multi-invalidation:${index}:${offset}`));
    const partialMulti = runScanScenario(benchmarkProject, multiFiles.length, multiFiles.length);

    clearProjectState(benchmarkProject);
    const rescanAfterInvalidation = runScanScenario(benchmarkProject, cold.fileCount, cold.fileCount);

    totalFiles = cold.fileCount;
    kindCounts = {
      components: cold.result.files.filter((item) => item.kind === "component").length,
      linkedTs: cold.result.files.filter((item) => item.kind === "linked-ts").length,
    };

    coldSamples.push({ ...cold, changedFileCount: cold.fileCount });
    warmSamples.push({ ...warm, changedFileCount: 0 });
    partialSingleSamples.push(partialSingle);
    partialMultiSamples.push(partialMulti);
    rescanAfterInvalidationSamples.push(rescanAfterInvalidation);
  }

  const runs = {
    cold: aggregateScenario(coldSamples),
    warm: aggregateScenario(warmSamples),
    partialSingle: aggregateScenario(partialSingleSamples),
    partialMulti: aggregateScenario(partialMultiSamples),
    rescanAfterInvalidation: aggregateScenario(rescanAfterInvalidationSamples),
  };

  return {
    kind: "scan-cache-bench",
    layer: "cli-e2e",
    repeatCount,
    totalFiles,
    kindCounts,
    runs,
    ratios: {
      warmVsCold: round(runs.warm.avgMs / runs.cold.avgMs),
      partialSingleVsCold: round(runs.partialSingle.avgMs / runs.cold.avgMs),
      partialMultiVsCold: round(runs.partialMulti.avgMs / runs.cold.avgMs),
      rescanVsCold: round(runs.rescanAfterInvalidation.avgMs / runs.cold.avgMs),
    },
  };
}

function baseExtractionResult(result) {
  const { mode, ...rest } = result;
  return rest;
}

export function runExtractSuite() {
  const { fixtures } = loadFixtureSet();
  const records = fixtures.map((fixture) => {
    const absolutePath = path.join(repoRoot, fixture.filePath);
    const sourceBytes = Buffer.byteLength(fs.readFileSync(absolutePath, "utf8"), "utf8");
    const extraction = measure(() => extractFile(absolutePath));
    const decide = measure(() => decideMode(baseExtractionResult(extraction.value)));
    const extractBytes = Buffer.byteLength(JSON.stringify(extraction.value), "utf8");

    return {
      kind: "extract-bench",
      layer: "core",
      fixtureId: fixture.id,
      file: fixture.filePath,
      type: fixture.type,
      rawBytes: sourceBytes,
      extractBytes,
      reductionPct: round((1 - (extractBytes / sourceBytes)) * 100),
      extractMs: extraction.durationMs,
      decideMs: decide.durationMs,
      mode: extraction.value.mode,
      componentName: extraction.value.componentName,
      importCount: extraction.value.meta.importCount,
    };
  });

  return {
    kind: "extract-bench-suite",
    layer: "core",
    fixtures: records,
  };
}

export function runStabilitySuite({ repeatCount = resolveRepeatCount(), scanScenarios } = {}) {
  const stableScanScenarios = scanScenarios ?? runScanCacheSuite({ repeatCount }).runs;
  const { fixtures } = loadFixtureSet();
  const extract = fixtures.map((fixture) => {
    const absolutePath = path.join(repoRoot, fixture.filePath);
    const extractTimings = [];
    const decideTimings = [];

    for (let index = 0; index < repeatCount; index += 1) {
      const extraction = measure(() => extractFile(absolutePath));
      const decision = measure(() => decideMode(baseExtractionResult(extraction.value)));
      extractTimings.push(extraction.durationMs);
      decideTimings.push(decision.durationMs);
    }

    return {
      fixtureId: fixture.id,
      file: fixture.filePath,
      type: fixture.type,
      extract: summariseNumbers(extractTimings),
      decide: summariseNumbers(decideTimings),
    };
  });

  return {
    kind: "stability-bench",
    repeatCount,
    scanScenarios: stableScanScenarios,
    extract,
  };
}

export function evaluatePreservation(extracted, expectation) {
  const exports = (expectation.exportNames ?? []).every((name) => extracted.exports.some((item) => item.name === name));
  const componentName = expectation.componentName ? extracted.componentName === expectation.componentName : true;
  const props = (expectation.propsPresent ?? []).every((prop) => (extracted.contract?.propsSummary ?? []).some((summary) => summary.includes(prop)));
  const hooks = (expectation.hookUsage ?? []).every((hook) => (extracted.behavior?.hooks ?? []).includes(hook));
  const styleSystem = expectation.styleSystem ? (extracted.style?.system ?? "unknown") === expectation.styleSystem : true;
  const importHint = typeof expectation.minimumImportCount === "number" ? extracted.meta.importCount >= expectation.minimumImportCount : true;

  const preserved = { exports, componentName, props, hooks, styleSystem, importHint };
  const values = Object.values(preserved);
  const preservedCount = values.filter(Boolean).length;

  return {
    passed: values.every(Boolean),
    preserved,
    preservedCount,
    preservationRate: round(preservedCount / values.length, 4),
  };
}

export function evaluateMode(actualMode, expectation) {
  const expectedModes = expectation.expectedModes ?? [];
  return {
    passed: expectedModes.includes(actualMode),
    expectedModes,
    actualMode,
  };
}

export function runGateSuite() {
  const { fixtures } = loadFixtureSet();
  const preservationExpectations = loadPreservationExpectations();
  const modeExpectations = loadModeExpectations();

  const preservation = [];
  const modeDecision = [];

  for (const fixture of fixtures) {
    const absolutePath = path.join(repoRoot, fixture.filePath);
    const extracted = extractFile(absolutePath);
    const preservationResult = evaluatePreservation(extracted, preservationExpectations[fixture.id] ?? {});
    const modeResult = evaluateMode(extracted.mode, modeExpectations[fixture.id] ?? {});

    preservation.push({
      fixtureId: fixture.id,
      file: fixture.filePath,
      type: fixture.type,
      ...preservationResult,
    });

    modeDecision.push({
      fixtureId: fixture.id,
      file: fixture.filePath,
      type: fixture.type,
      ...modeResult,
    });
  }

  return {
    kind: "gate-bench",
    preservation: {
      fixtures: preservation,
      passed: preservation.every((item) => item.passed),
    },
    modeDecision: {
      fixtures: modeDecision,
      passed: modeDecision.every((item) => item.passed),
    },
  };
}

export function computeFinalGates({ scanCache, extract, gateSuite }) {
  const results = [
    {
      name: "warmAvgMs <= coldAvgMs",
      passed: scanCache.runs.warm.avgMs <= scanCache.runs.cold.avgMs,
      actual: scanCache.runs.warm.avgMs,
      expected: `<= ${scanCache.runs.cold.avgMs}`,
    },
    {
      name: "partialSingleAvgMs <= coldAvgMs",
      passed: scanCache.runs.partialSingle.avgMs <= scanCache.runs.cold.avgMs,
      actual: scanCache.runs.partialSingle.avgMs,
      expected: `<= ${scanCache.runs.cold.avgMs}`,
    },
    ...extract.fixtures
      .map((fixture) => {
        const lowerBound = loadFixtureSet().fixtures.find((item) => item.id === fixture.fixtureId)?.reductionLowerBound;
        if (typeof lowerBound !== "number") {
          return null;
        }
        return {
          name: `${fixture.fixtureId} reductionPct >= lowerBound`,
          passed: fixture.reductionPct >= lowerBound,
          actual: fixture.reductionPct,
          expected: `>= ${lowerBound}`,
        };
      })
      .filter(Boolean),
    ...gateSuite.preservation.fixtures.map((fixture) => ({
      name: `${fixture.fixtureId} critical metadata preserved`,
      passed: fixture.passed,
      actual: fixture.preserved,
      expected: true,
    })),
    ...gateSuite.modeDecision.fixtures.map((fixture) => ({
      name: `${fixture.fixtureId} actualMode ∈ expectedModes`,
      passed: fixture.passed,
      actual: fixture.actualMode,
      expected: fixture.expectedModes,
    })),
  ];

  return {
    passed: results.every((item) => item.passed),
    results,
  };
}

export function printSummaryLines(lines) {
  for (const line of lines) {
    console.error(line);
  }
}

export function scanCacheSummary(report, latestPath) {
  return [
    `fooks benchmark | scan-cache | latest: ${relativeToRepo(latestPath)}`,
    `- cold avg: ${report.runs.cold.avgMs}ms`,
    `- warm avg: ${report.runs.warm.avgMs}ms (${report.ratios.warmVsCold}x of cold)`,
    `- partial(single) avg: ${report.runs.partialSingle.avgMs}ms (${report.ratios.partialSingleVsCold}x of cold)`,
    `- partial(multi) avg: ${report.runs.partialMulti.avgMs}ms (${report.ratios.partialMultiVsCold}x of cold)`,
    `- rescan after invalidation avg: ${report.runs.rescanAfterInvalidation.avgMs}ms`,
    `- warm runtime split: cli ${report.runs.warm.runtimeBreakdown.cliWallMs}ms / scan ${report.runs.warm.runtimeBreakdown.scanCoreMs}ms / outside-scan ${report.runs.warm.runtimeBreakdown.outsideScanMs}ms`,
  ];
}

export function extractSummary(report, latestPath) {
  const lines = [
    `fooks benchmark | extract | latest: ${relativeToRepo(latestPath)}`,
  ];
  for (const fixture of report.fixtures) {
    lines.push(`- ${fixture.fixtureId}: ${fixture.mode}, ${fixture.reductionPct}% reduction, extract ${fixture.extractMs}ms, decide ${fixture.decideMs}ms`);
  }
  return lines;
}

export function stabilitySummary(report, latestPath) {
  return [
    `fooks benchmark | stability | latest: ${relativeToRepo(latestPath)}`,
    `- repeat count: ${report.repeatCount}`,
    `- cold avg/min/max: ${report.scanScenarios.cold.avgMs}/${report.scanScenarios.cold.minMs}/${report.scanScenarios.cold.maxMs}ms`,
    `- warm avg/min/max: ${report.scanScenarios.warm.avgMs}/${report.scanScenarios.warm.minMs}/${report.scanScenarios.warm.maxMs}ms`,
    ...report.extract.map((fixture) => `- ${fixture.fixtureId}: extract avg ${fixture.extract.avgMs}ms, decide avg ${fixture.decide.avgMs}ms`),
  ];
}

export function gateSummary(report, latestPath) {
  return [
    `fooks benchmark | gate | latest: ${relativeToRepo(latestPath)}`,
    `- preservation passed: ${report.preservation.passed}`,
    `- mode decision passed: ${report.modeDecision.passed}`,
  ];
}

export function runAllSuites({ repeatCount = resolveRepeatCount() } = {}) {
  const fixtureSet = loadFixtureSet();
  const runId = new Date().toISOString();
  const scanCache = runScanCacheSuite({ repeatCount });
  const extract = runExtractSuite();
  const stability = runStabilitySuite({ repeatCount, scanScenarios: scanCache.runs });
  const gateSuite = runGateSuite();
  const gates = computeFinalGates({ scanCache, extract, gateSuite });
  const envelope = createEnvelope({
    runId,
    fixtureSetVersion: fixtureSet.version,
    suites: {
      scanCache,
      extract: extract.fixtures,
      stability,
      preservation: gateSuite.preservation,
      modeDecision: gateSuite.modeDecision,
    },
    gates,
  });
  return { runId, fixtureSetVersion: fixtureSet.version, envelope, scanCache, extract, stability, gateSuite, gates };
}
