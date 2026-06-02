import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FIELD_ARRAY_FIXTURE,
  buildReactWebFieldArrayDogfoodEvidence,
} from "./react-web-field-array-dogfood-evidence.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const REACT_WEB_FIELD_ARRAY_TASK_OUTCOME_SCHEMA_VERSION = "react-web-field-array-task-outcome-evidence.v1";

const TASK = {
  id: "field-array-add-contact-phone",
  description:
    "Add a phone field to each contact row while preserving useFieldArray fields.map rendering, register path shape, append/remove controls, and submit flow.",
  requiredSignals: [
    {
      id: "useFieldArray-anchor",
      label: "useFieldArray patch target",
      rationale: "The edit must recognize the component is a dynamic field-array form, not a static register-only form.",
    },
    {
      id: "dynamic-fields-role",
      label: "dynamic-fields form-state role",
      rationale: "The edit should preserve array-row semantics such as fields.map, append, and remove.",
    },
    {
      id: "field-registration-role",
      label: "field-registration form-state role",
      rationale: "The edit should preserve register path shape such as contacts.${index}.field.",
    },
    {
      id: "submit-flow-role",
      label: "submit-flow form-state role",
      rationale: "The edit should avoid breaking handleSubmit/form submission while adding fields.",
    },
  ],
};

function selectedContains(anchors, predicate) {
  return anchors.some(predicate);
}

function roleCoverage(evidence, role, budgetName) {
  return evidence[budgetName]?.dynamicFieldsRoleCoverage?.role === role
    ? evidence[budgetName].dynamicFieldsRoleCoverage
    : null;
}

function formStateRoleCoverage(evidence, role, budgetName) {
  if (role === "dynamic-fields") return roleCoverage(evidence, role, budgetName);
  const anchors = evidence[budgetName]?.deferredFormStateRoles ?? [];
  const deferred = anchors.find((anchor) => anchor.kind === `form-state-role:${role}`);
  const selected = (evidence[budgetName]?.selectedAnchors ?? []).find((anchor) => anchor.kind === `form-state-role:${role}`);
  if (selected) {
    return { role, status: "selected", selectedCount: 1, deferredCount: 0, labels: [selected.label], reasons: ["selected-within-anchor-budget"] };
  }
  if (deferred) {
    return { role, status: "deferred", selectedCount: 0, deferredCount: 1, labels: [deferred.label], reasons: [deferred.deferredReason ?? "deferred"] };
  }
  return null;
}

function evaluateBudget(evidence, budgetName) {
  const budget = evidence[budgetName];
  const selected = budget.selectedAnchors;
  const checks = [
    {
      id: "useFieldArray-anchor",
      present: selectedContains(selected, (anchor) => anchor.kind === "patch-target:validation-anchor" && anchor.label === "useFieldArray"),
      evidence: selected.find((anchor) => anchor.kind === "patch-target:validation-anchor" && anchor.label === "useFieldArray") ?? null,
      missingReason: "useFieldArray patch target is outside selected anchor budget",
    },
    {
      id: "dynamic-fields-role",
      present: formStateRoleCoverage(evidence, "dynamic-fields", budgetName)?.status === "selected",
      evidence: formStateRoleCoverage(evidence, "dynamic-fields", budgetName),
      missingReason: "dynamic-fields role is not selected; role coverage is deferred or missing",
    },
    {
      id: "field-registration-role",
      present: formStateRoleCoverage(evidence, "field-registration", budgetName)?.status === "selected",
      evidence: formStateRoleCoverage(evidence, "field-registration", budgetName),
      missingReason: "field-registration role is not selected; register-path semantics remain indirect",
    },
    {
      id: "submit-flow-role",
      present: formStateRoleCoverage(evidence, "submit-flow", budgetName)?.status === "selected",
      evidence: formStateRoleCoverage(evidence, "submit-flow", budgetName),
      missingReason: "submit-flow role is not selected; submission semantics remain indirect",
    },
  ];
  const presentCount = checks.filter((check) => check.present).length;
  const missing = checks.filter((check) => !check.present).map((check) => ({ id: check.id, reason: check.missingReason, evidence: check.evidence }));
  const requiredCount = checks.length;
  const readiness = presentCount === requiredCount
    ? "ready"
    : checks[0].present
      ? "partial"
      : "insufficient";

  return {
    budgetName,
    maxAnchors: budget.maxAnchors,
    selectedAnchorCount: budget.selectedAnchorCount,
    deferredAnchorCount: budget.deferredAnchorCount,
    readiness,
    presentCount,
    requiredCount,
    checks,
    missing,
  };
}

function recommend(defaultEvaluation, wideEvaluation) {
  const defaultUseFieldArray = defaultEvaluation.checks.find((check) => check.id === "useFieldArray-anchor")?.present ?? false;
  const wideUseFieldArray = wideEvaluation.checks.find((check) => check.id === "useFieldArray-anchor")?.present ?? false;
  const wideDynamicRole = wideEvaluation.checks.find((check) => check.id === "dynamic-fields-role")?.present ?? false;

  if (!defaultUseFieldArray && wideUseFieldArray) {
    return {
      verdict: "promote-useFieldArray-patch-target-before-dynamic-role",
      reason:
        "The default budget misses the concrete useFieldArray patch target while a wider budget selects it; prioritize the concrete edit target before promoting broader role nodes.",
      nextAction:
        "Add a narrow consumer-priority rule for useFieldArray validation-anchor evidence, then rerun this task-outcome dogfood before considering dynamic-fields role promotion.",
    };
  }

  if (defaultUseFieldArray && !wideDynamicRole) {
    return {
      verdict: "consider-dynamic-fields-role-after-task-miss",
      reason:
        "The concrete useFieldArray patch target is already visible, but dynamic-fields role is still absent; only promote the role if live task outcome misses row-array semantics.",
      nextAction: "Keep current priority and gather live edit outcome evidence.",
    };
  }

  if (defaultEvaluation.readiness === "ready") {
    return {
      verdict: "no-priority-change-needed",
      reason: "Default selected anchors cover all deterministic field-array task signals.",
      nextAction: "No-op unless live model edits regress.",
    };
  }

  return {
    verdict: "inspect-priority-manually",
    reason: "The deterministic signal pattern did not match a known priority recommendation.",
    nextAction: "Inspect selected/deferred anchors before changing priorities.",
  };
}

export async function buildReactWebFieldArrayTaskOutcomeEvidence({
  repoRoot = defaultRepoRoot,
  fixture = DEFAULT_FIELD_ARRAY_FIXTURE,
  runId = new Date().toISOString().replace(/[:.]/g, "-"),
} = {}) {
  const priorityEvidence = await buildReactWebFieldArrayDogfoodEvidence({ repoRoot, fixture, runId });
  const absoluteFixture = path.join(repoRoot, fixture);
  const source = fs.readFileSync(absoluteFixture, "utf8");
  const defaultEvaluation = evaluateBudget(priorityEvidence, "defaultBudget");
  const wideEvaluation = evaluateBudget(priorityEvidence, "wideBudget");
  const recommendation = recommend(defaultEvaluation, wideEvaluation);

  return {
    schemaVersion: REACT_WEB_FIELD_ARRAY_TASK_OUTCOME_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    runId,
    measurement: "react-web-field-array-deterministic-task-outcome-readiness",
    fixture,
    task: TASK,
    claimBoundary:
      "Deterministic local task-readiness evidence only: evaluates whether selected consumer anchors expose signals required for a field-array edit task. It is not live Codex/Claude model outcome proof, not task accuracy proof, not runtime authorization, and not token/cost/billing evidence.",
    sourceSignals: {
      containsUseFieldArray: /\buseFieldArray\b/.test(source),
      containsFieldsMap: /\bfields\.map\s*\(/.test(source),
      containsRegisterPath: /register\(`contacts\.\$\{index\}/.test(source) || /register\("contacts\."\s*\+\s*index/.test(source),
      containsAppend: /\bappend\s*\(/.test(source),
      containsRemove: /\bremove\s*\(/.test(source),
      containsHandleSubmit: /\bhandleSubmit\s*\(/.test(source),
    },
    evaluations: {
      defaultBudget: defaultEvaluation,
      wideBudget: wideEvaluation,
    },
    recommendation,
    priorityEvidenceSummary: {
      schemaVersion: priorityEvidence.schemaVersion,
      priorityVerdict: priorityEvidence.priorityDecision.verdict,
      defaultUseFieldArrayPatchTargetSelected: priorityEvidence.defaultBudget.useFieldArrayPatchTargetSelected,
      wideUseFieldArrayPatchTargetSelected: priorityEvidence.wideBudget.useFieldArrayPatchTargetSelected,
      defaultDynamicFieldsRoleCoverage: priorityEvidence.defaultBudget.dynamicFieldsRoleCoverage,
      wideDynamicFieldsRoleCoverage: priorityEvidence.wideBudget.dynamicFieldsRoleCoverage,
    },
  };
}

export function renderReactWebFieldArrayTaskOutcomeMarkdown(evidence) {
  const rows = [evidence.evaluations.defaultBudget, evidence.evaluations.wideBudget]
    .map((item) => `| ${item.budgetName} | ${item.maxAnchors} | ${item.readiness} | ${item.presentCount}/${item.requiredCount} | ${item.missing.map((missing) => missing.id).join(", ") || "none"} |`)
    .join("\n");
  const sourceSignals = Object.entries(evidence.sourceSignals)
    .map(([key, value]) => `- ${key}: ${value ? "yes" : "no"}`)
    .join("\n");
  const requiredSignals = evidence.task.requiredSignals
    .map((signal) => `- ${signal.id}: ${signal.label} — ${signal.rationale}`)
    .join("\n");

  return `# React Web field-array task-outcome dogfood evidence\n\n${evidence.claimBoundary}\n\n## Task\n\n- Task id: ${evidence.task.id}\n- Description: ${evidence.task.description}\n- Fixture: \`${evidence.fixture}\`\n\n## Source signals\n\n${sourceSignals}\n\n## Required task signals\n\n${requiredSignals}\n\n## Budget readiness\n\n| Budget | maxAnchors | readiness | present required signals | missing |\n| --- | ---: | --- | ---: | --- |\n${rows}\n\n## Recommendation\n\n- Verdict: ${evidence.recommendation.verdict}\n- Reason: ${evidence.recommendation.reason}\n- Next action: ${evidence.recommendation.nextAction}\n\n## Boundary\n\nThis artifact is deterministic task-readiness evidence. It does not claim live model edit success or provider token/cost savings.\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runId = process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ?? "local";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownArg = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);
  const fixtureArg = process.argv.find((arg) => arg.startsWith("--fixture="))?.slice("--fixture=".length);
  const evidence = await buildReactWebFieldArrayTaskOutcomeEvidence({ repoRoot: defaultRepoRoot, runId, fixture: fixtureArg ?? DEFAULT_FIELD_ARRAY_FIXTURE });

  if (outputArg) {
    const outputPath = path.resolve(defaultRepoRoot, outputArg);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (markdownArg) {
    const markdownPath = path.resolve(defaultRepoRoot, markdownArg);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderReactWebFieldArrayTaskOutcomeMarkdown(evidence));
  }
  if (!outputArg && !markdownArg) {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }
}
