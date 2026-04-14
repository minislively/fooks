import { loadFixtureSet, runStabilitySuite, writeResultArtifacts, printSummaryLines, stabilitySummary } from "./lib.mjs";

export function main() {
  const fixtureSet = loadFixtureSet();
  const runId = new Date().toISOString();
  const report = {
    runId,
    fixtureSetVersion: fixtureSet.version,
    ...runStabilitySuite(),
  };
  const artifacts = writeResultArtifacts("stability.json", report, runId);
  printSummaryLines(stabilitySummary(report, artifacts.latestPath));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
}

main();
