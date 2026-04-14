import { loadFixtureSet, runExtractSuite, writeResultArtifacts, printSummaryLines, extractSummary } from "./lib.mjs";

export function main() {
  const fixtureSet = loadFixtureSet();
  const runId = new Date().toISOString();
  const suite = runExtractSuite();
  const report = {
    runId,
    fixtureSetVersion: fixtureSet.version,
    ...suite,
  };
  const artifacts = writeResultArtifacts("extract.json", report, runId);
  printSummaryLines(extractSummary(report, artifacts.latestPath));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
}

main();
