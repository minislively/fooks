import { runAllSuites, writeResultArtifacts, printSummaryLines, relativeToRepo } from "./lib.mjs";

export function main() {
  const { runId, envelope } = runAllSuites();
  const artifacts = writeResultArtifacts("benchmark.json", envelope, runId);
  printSummaryLines([
    `fooks benchmark | all suites | latest: ${relativeToRepo(artifacts.latestPath)}`,
    `- gates passed: ${envelope.gates.passed}`,
    `- scan cold/warm/partial(single): ${envelope.suites.scanCache.runs.cold.avgMs}/${envelope.suites.scanCache.runs.warm.avgMs}/${envelope.suites.scanCache.runs.partialSingle.avgMs}ms`,
    `- extract fixtures: ${envelope.suites.extract.length}`,
    `- preservation fixtures: ${envelope.suites.preservation.fixtures.length}`,
    `- mode decision fixtures: ${envelope.suites.modeDecision.fixtures.length}`,
  ]);
  console.log(JSON.stringify({ ...envelope, artifacts }, null, 2));
}

main();
