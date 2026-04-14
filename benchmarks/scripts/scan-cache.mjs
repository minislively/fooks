import { loadFixtureSet, runScanCacheSuite, writeResultArtifacts, printSummaryLines, scanCacheSummary } from "./lib.mjs";

export function main() {
  const fixtureSet = loadFixtureSet();
  const runId = new Date().toISOString();
  const report = {
    runId,
    fixtureSetVersion: fixtureSet.version,
    ...runScanCacheSuite(),
  };
  const artifacts = writeResultArtifacts("scan-cache.json", report, runId);
  printSummaryLines(scanCacheSummary(report, artifacts.latestPath));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
}

main();
