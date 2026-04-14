import { loadFixtureSet, runScanCacheSuite, writeResultArtifacts, printSummaryLines, scanCacheSummary, mergeHarnessBreakdown } from "./lib.mjs";

export function main() {
  const fixtureSet = loadFixtureSet();
  const runId = new Date().toISOString();
  const initialReport = {
    runId,
    fixtureSetVersion: fixtureSet.version,
    ...runScanCacheSuite(),
  };
  const firstArtifacts = writeResultArtifacts("scan-cache.json", initialReport, runId);
  const report = {
    ...initialReport,
    harnessBreakdown: mergeHarnessBreakdown(initialReport.harnessBreakdown, firstArtifacts.harnessBreakdown),
  };
  const artifacts = writeResultArtifacts("scan-cache.json", report, runId);
  printSummaryLines(scanCacheSummary(report, artifacts.latestPath));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
}

main();
