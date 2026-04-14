import { loadFixtureSet, runGateSuite, runScanCacheSuite, runExtractSuite, computeFinalGates, writeResultArtifacts, printSummaryLines, gateSummary } from "./lib.mjs";

export function main() {
  const fixtureSet = loadFixtureSet();
  const runId = new Date().toISOString();
  const scanCache = runScanCacheSuite();
  const extract = runExtractSuite();
  const gateSuite = runGateSuite();
  const gates = computeFinalGates({ scanCache, extract, gateSuite });
  const report = {
    runId,
    fixtureSetVersion: fixtureSet.version,
    kind: "gate-summary",
    preservation: gateSuite.preservation,
    modeDecision: gateSuite.modeDecision,
    gates,
  };
  const artifacts = writeResultArtifacts("gate.json", report, runId);
  printSummaryLines(gateSummary(report, artifacts.latestPath));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
}

main();
