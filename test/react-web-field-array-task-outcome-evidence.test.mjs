import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import {
  REACT_WEB_FIELD_ARRAY_TASK_OUTCOME_SCHEMA_VERSION,
  buildReactWebFieldArrayTaskOutcomeEvidence,
  renderReactWebFieldArrayTaskOutcomeMarkdown,
} from "../scripts/react-web-field-array-task-outcome-evidence.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("field-array task outcome dogfood recommends concrete patch-target promotion first", async () => {
  const evidence = await buildReactWebFieldArrayTaskOutcomeEvidence({ repoRoot, runId: "test" });

  assert.equal(evidence.schemaVersion, REACT_WEB_FIELD_ARRAY_TASK_OUTCOME_SCHEMA_VERSION);
  assert.equal(evidence.measurement, "react-web-field-array-deterministic-task-outcome-readiness");
  assert.equal(evidence.sourceSignals.containsUseFieldArray, true);
  assert.equal(evidence.sourceSignals.containsFieldsMap, true);
  assert.equal(evidence.sourceSignals.containsRegisterPath, true);
  assert.equal(evidence.evaluations.defaultBudget.readiness, "insufficient");
  assert.equal(evidence.evaluations.wideBudget.readiness, "partial");
  assert.equal(evidence.priorityEvidenceSummary.defaultUseFieldArrayPatchTargetSelected, false);
  assert.equal(evidence.priorityEvidenceSummary.wideUseFieldArrayPatchTargetSelected, true);
  assert.equal(evidence.recommendation.verdict, "promote-useFieldArray-patch-target-before-dynamic-role");
  assert.match(evidence.claimBoundary, /not live Codex\/Claude model outcome proof/);
  assert.match(evidence.claimBoundary, /not token\/cost\/billing evidence/);

  const markdown = renderReactWebFieldArrayTaskOutcomeMarkdown(evidence);
  assert.match(markdown, /field-array task-outcome dogfood evidence/);
  assert.match(markdown, /promote-useFieldArray-patch-target-before-dynamic-role/);
  assert.match(markdown, /defaultBudget/);
  assert.match(markdown, /wideBudget/);
});

test("field-array task outcome dogfood CLI writes JSON and markdown", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-field-array-task-outcome-"));
  try {
    const outputPath = path.join(tempDir, "evidence.json");
    const markdownPath = path.join(tempDir, "evidence.md");
    const result = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts", "react-web-field-array-task-outcome-evidence.mjs"),
      "--run-id=cli-test",
      `--output=${outputPath}`,
      `--markdown-output=${markdownPath}`,
    ], { cwd: repoRoot, encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const evidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const markdown = fs.readFileSync(markdownPath, "utf8");
    assert.equal(evidence.schemaVersion, REACT_WEB_FIELD_ARRAY_TASK_OUTCOME_SCHEMA_VERSION);
    assert.match(markdown, /Budget readiness/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
