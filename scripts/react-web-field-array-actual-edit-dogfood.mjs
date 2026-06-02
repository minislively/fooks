import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_FIELD_ARRAY_FIXTURE } from "./react-web-field-array-dogfood-evidence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const REACT_WEB_FIELD_ARRAY_ACTUAL_EDIT_SCHEMA_VERSION = "react-web-field-array-actual-edit-dogfood.v1";

async function loadBuiltIndex(repoRoot) {
  return import(path.join(repoRoot, "dist", "index.js"));
}

function selectedUseFieldArrayAnchor(dryRun) {
  return dryRun.selectedAnchors.find(
    (anchor) => anchor.kind === "patch-target:validation-anchor" && anchor.label === "useFieldArray",
  ) ?? null;
}

function applyPhoneFieldEdit(source) {
  let edited = source;
  edited = edited.replace("type Contact = { email: string };", "type Contact = { email: string; phone: string };");
  edited = edited.replace('defaultValues: { contacts: [{ email: "" }] },', 'defaultValues: { contacts: [{ email: "", phone: "" }] },');
  edited = edited.replace(
    '<input id={`contacts-${index}-email`} {...register(`contacts.${index}.email`)} />',
    '<input id={`contacts-${index}-email`} {...register(`contacts.${index}.email`)} />\n          <label htmlFor={`contacts-${index}-phone`}>Phone</label>\n          <input id={`contacts-${index}-phone`} {...register(`contacts.${index}.phone`)} />',
  );
  edited = edited.replace('append({ email: "" })', 'append({ email: "", phone: "" })');
  if (edited === source) throw new Error("field-array edit did not change source");
  return edited;
}

function validateEditedSource(source) {
  const checks = [
    { id: "keeps-useFieldArray", pass: /\buseFieldArray\b/.test(source) },
    { id: "keeps-fields-map", pass: /\bfields\.map\s*\(/.test(source) },
    { id: "keeps-remove", pass: /\bremove\s*\(index\)/.test(source) },
    { id: "keeps-handleSubmit", pass: /\bhandleSubmit\s*\(/.test(source) },
    { id: "adds-contact-phone-type", pass: /type Contact = \{ email: string; phone: string \};/.test(source) },
    { id: "adds-default-phone", pass: /contacts: \[\{ email: "", phone: "" \}\]/.test(source) },
    { id: "adds-phone-register-path", pass: /register\(`contacts\.\$\{index\}\.phone`\)/.test(source) },
    { id: "keeps-email-register-path", pass: /register\(`contacts\.\$\{index\}\.email`\)/.test(source) },
    { id: "adds-phone-label", pass: /contacts-\$\{index\}-phone/.test(source) && />Phone<\//.test(source) },
    { id: "append-adds-phone", pass: /append\(\{ email: "", phone: "" \}\)/.test(source) },
  ];
  return {
    checks,
    passed: checks.every((check) => check.pass),
    failed: checks.filter((check) => !check.pass).map((check) => check.id),
  };
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

export async function buildReactWebFieldArrayActualEditDogfood({
  repoRoot = defaultRepoRoot,
  fixture = DEFAULT_FIELD_ARRAY_FIXTURE,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const { buildReactWebFactGraphConsumerDryRun } = await loadBuiltIndex(repoRoot);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-field-array-actual-edit-"));
  const tempFixture = path.join(tempRoot, fixture);
  const sourceFixture = path.join(repoRoot, fixture);
  try {
    fs.mkdirSync(path.dirname(tempFixture), { recursive: true });
    fs.copyFileSync(sourceFixture, tempFixture);
    const beforeSource = fs.readFileSync(tempFixture, "utf8");
    const beforeDryRun = buildReactWebFactGraphConsumerDryRun(tempFixture, tempRoot);
    const selectedUseFieldArray = selectedUseFieldArrayAnchor(beforeDryRun);

    const editedSource = applyPhoneFieldEdit(beforeSource);
    fs.writeFileSync(tempFixture, editedSource);
    const validation = validateEditedSource(editedSource);
    const afterDryRun = buildReactWebFactGraphConsumerDryRun(tempFixture, tempRoot);

    return {
      schemaVersion: REACT_WEB_FIELD_ARRAY_ACTUAL_EDIT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      runId,
      measurement: "react-web-field-array-actual-edit-dogfood",
      fixture,
      task: {
        id: "field-array-add-contact-phone-actual-edit",
        description: "Actually edit a copied field-array fixture to add a phone field while preserving array row semantics.",
      },
      claimBoundary:
        "Local actual-edit dogfood evidence only: applies a deterministic source edit to a copied fixture and validates field-array invariants. It is not live Codex/Claude model outcome proof, not provider-token/cost/billing evidence, and not runtime authorization.",
      preEditConsumer: {
        maxAnchors: beforeDryRun.selectionPolicy.maxAnchors,
        selectedAnchorCount: beforeDryRun.selectedAnchors.length,
        selectedUseFieldArrayAnchor: selectedUseFieldArray,
        selectedUseFieldArrayRank: selectedUseFieldArray?.rank ?? null,
        selectedUseFieldArrayPriority: selectedUseFieldArray?.priority ?? null,
      },
      edit: {
        beforeBytes: byteLength(beforeSource),
        afterBytes: byteLength(editedSource),
        changedBytes: byteLength(editedSource) - byteLength(beforeSource),
        applied: editedSource !== beforeSource,
      },
      validation,
      postEditConsumer: {
        maxAnchors: afterDryRun.selectionPolicy.maxAnchors,
        selectedAnchorCount: afterDryRun.selectedAnchors.length,
        selectedUseFieldArrayAnchor: selectedUseFieldArrayAnchor(afterDryRun),
      },
      verdict: validation.passed && Boolean(selectedUseFieldArray)
        ? "actual-edit-passed-with-useFieldArray-visible"
        : "actual-edit-needs-review",
      nextAction: validation.passed && Boolean(selectedUseFieldArray)
        ? "Do not promote dynamic-fields role yet; gather live model edit misses before adding broader role priority."
        : "Inspect failed validation or missing useFieldArray visibility before changing priorities.",
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function renderReactWebFieldArrayActualEditDogfoodMarkdown(evidence) {
  const checks = evidence.validation.checks
    .map((check) => `- ${check.id}: ${check.pass ? "pass" : "fail"}`)
    .join("\n");

  return `# React Web field-array actual edit dogfood\n\n${evidence.claimBoundary}\n\n## Task\n\n- Task id: ${evidence.task.id}\n- Fixture: \`${evidence.fixture}\`\n- Verdict: ${evidence.verdict}\n- Next action: ${evidence.nextAction}\n\n## Pre-edit consumer\n\n- maxAnchors: ${evidence.preEditConsumer.maxAnchors}\n- selected anchors: ${evidence.preEditConsumer.selectedAnchorCount}\n- useFieldArray selected rank: ${evidence.preEditConsumer.selectedUseFieldArrayRank ?? "missing"}\n- useFieldArray selected priority: ${evidence.preEditConsumer.selectedUseFieldArrayPriority ?? "missing"}\n\n## Actual edit\n\n- Applied: ${evidence.edit.applied ? "yes" : "no"}\n- Before bytes: ${evidence.edit.beforeBytes}\n- After bytes: ${evidence.edit.afterBytes}\n- Changed bytes: ${evidence.edit.changedBytes}\n\n## Validation\n\n- Passed: ${evidence.validation.passed ? "yes" : "no"}\n- Failed: ${evidence.validation.failed.length > 0 ? evidence.validation.failed.join(", ") : "none"}\n\n${checks}\n\n## Boundary\n\nThis is local actual-edit dogfood on a copied fixture. It validates source invariants but does not prove live model task quality or provider token/cost savings.\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture="))?.slice("--fixture=".length);
  const evidence = await buildReactWebFieldArrayActualEditDogfood({ repoRoot: defaultRepoRoot, runId, fixture: fixtureArg ?? DEFAULT_FIELD_ARRAY_FIXTURE });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebFieldArrayActualEditDogfoodMarkdown(evidence));
  }
  if (!outputArg && !markdownArg) {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }
}
