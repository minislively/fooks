import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import {
  REACT_WEB_FIELD_ARRAY_ACTUAL_EDIT_SCHEMA_VERSION,
  buildReactWebFieldArrayActualEditDogfood,
  renderReactWebFieldArrayActualEditDogfoodMarkdown,
} from "../scripts/react-web-field-array-actual-edit-dogfood.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("field-array actual edit dogfood passes with useFieldArray visible", async () => {
  const evidence = await buildReactWebFieldArrayActualEditDogfood({ repoRoot, runId: "test" });

  assert.equal(evidence.schemaVersion, REACT_WEB_FIELD_ARRAY_ACTUAL_EDIT_SCHEMA_VERSION);
  assert.equal(evidence.measurement, "react-web-field-array-actual-edit-dogfood");
  assert.equal(evidence.preEditConsumer.selectedUseFieldArrayRank, 1);
  assert.equal(evidence.preEditConsumer.selectedUseFieldArrayPriority, 110);
  assert.equal(evidence.edit.applied, true);
  assert.equal(evidence.validation.passed, true);
  assert.deepEqual(evidence.validation.failed, []);
  assert.equal(evidence.verdict, "actual-edit-passed-with-useFieldArray-visible");
  assert.match(evidence.claimBoundary, /not live Codex\/Claude model outcome proof/);
  assert.match(evidence.claimBoundary, /not provider-token\/cost\/billing evidence/);

  const markdown = renderReactWebFieldArrayActualEditDogfoodMarkdown(evidence);
  assert.match(markdown, /actual edit dogfood/);
  assert.match(markdown, /useFieldArray selected rank: 1/);
  assert.match(markdown, /adds-phone-register-path: pass/);
});

test("field-array actual edit dogfood CLI writes JSON and markdown", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-field-array-actual-edit-cli-"));
  try {
    const outputPath = path.join(tempDir, "evidence.json");
    const markdownPath = path.join(tempDir, "evidence.md");
    const result = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts", "react-web-field-array-actual-edit-dogfood.mjs"),
      "--run-id=cli-test",
      `--output=${outputPath}`,
      `--markdown-output=${markdownPath}`,
    ], { cwd: repoRoot, encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const evidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const markdown = fs.readFileSync(markdownPath, "utf8");
    assert.equal(evidence.schemaVersion, REACT_WEB_FIELD_ARRAY_ACTUAL_EDIT_SCHEMA_VERSION);
    assert.match(markdown, /Validation/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
