import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

const fixtureCopies = [
  ["fixtures/raw/SimpleButton.tsx", "SimpleButton"],
  ["fixtures/compressed/FormSection.tsx", "FormSection"],
  ["fixtures/hybrid/DashboardPanel.tsx", "DashboardPanel"],
];

function makeBenchmarkProject(copyCount = 20) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fe-lens-bench-"));
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src", "ts-linked"), { recursive: true });

  fs.copyFileSync(path.join(repoRoot, "fixtures", "ts-linked", "Button.types.ts"), path.join(tempDir, "src", "ts-linked", "Button.types.ts"));
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify(
      {
        name: "fe-lens-benchmark",
        repository: { url: "https://github.com/minislively/fe-lens-benchmark.git" },
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < copyCount; index += 1) {
    for (const [fixturePath, componentName] of fixtureCopies) {
      let source = fs.readFileSync(path.join(repoRoot, fixturePath), "utf8");
      if (componentName === "FormSection") {
        const utilBaseName = `FormSection${index}.utils`;
        source = source.replace("../ts-linked/FormSection.utils", `../ts-linked/${utilBaseName}`);
        const utilSource = `${fs.readFileSync(path.join(repoRoot, "fixtures", "ts-linked", "FormSection.utils.ts"), "utf8").trimEnd()}\n// benchmark-util-copy:${index}\n`;
        fs.writeFileSync(path.join(tempDir, "src", "ts-linked", `${utilBaseName}.ts`), utilSource);
      }

      const uniqueSource = `${source.trimEnd()}\n// benchmark-component-copy:${index}\n`;
      fs.writeFileSync(path.join(tempDir, "src", "components", `${componentName}${index}.tsx`), uniqueSource);
    }
  }

  return tempDir;
}

function runScan(cwd) {
  const startedAt = performance.now();
  const result = JSON.parse(execFileSync(process.execPath, [cliPath, "scan"], { cwd, encoding: "utf8" }));
  return {
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    result,
  };
}

function appendMarker(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, `${source.trimEnd()}\n// benchmark-cache-marker\n`);
}

function summarize(label, run, totalFiles) {
  return {
    label,
    durationMs: run.durationMs,
    files: run.result.files.length,
    refreshedEntries: run.result.refreshedEntries,
    reusedCacheEntries: run.result.reusedCacheEntries,
    cacheHitRatio: totalFiles === 0 ? 0 : Number((run.result.reusedCacheEntries / totalFiles).toFixed(2)),
  };
}

const benchmarkProject = makeBenchmarkProject();
const cold = runScan(benchmarkProject);
const warm = runScan(benchmarkProject);

const changedFile = path.join(benchmarkProject, "src", "components", "DashboardPanel7.tsx");
appendMarker(changedFile);
const partial = runScan(benchmarkProject);

const totalFiles = cold.result.files.length;

const report = {
  benchmarkProject,
  totalFiles,
  kindCounts: {
    components: cold.result.files.filter((item) => item.kind === "component").length,
    linkedTs: cold.result.files.filter((item) => item.kind === "linked-ts").length,
  },
  scenarios: [
    summarize("cold", cold, totalFiles),
    summarize("warm", warm, totalFiles),
    summarize("partial-invalidation", partial, totalFiles),
  ],
  ratios: {
    warmVsCold: Number((warm.durationMs / cold.durationMs).toFixed(2)),
    partialVsCold: Number((partial.durationMs / cold.durationMs).toFixed(2)),
  },
};

console.log(JSON.stringify(report, null, 2));
