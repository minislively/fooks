import path from "node:path";
import { decideCodexPreRead } from "./codex-pre-read";
import { codexRuntimeEscapeHatches, extractPromptTarget, hasFullReadEscapeHatch } from "./codex-runtime-prompt";
import { buildPreReadReuseStatus } from "./codex-runtime-status";
import {
  clearCodexRuntimeSession,
  initializeCodexRuntimeSession,
  markCodexRuntimeSeenFile,
  resolveCodexRuntimeSessionKey,
} from "./codex-runtime-session";
import type { CodexRuntimeHookDecision, CodexRuntimeHookInput, ModelFacingPayload } from "../core/schema";

function buildAdditionalContext(filePath: string, payload: ModelFacingPayload): string {
  return [
    `${buildPreReadReuseStatus(payload.mode)} · file: ${filePath} · use ${codexRuntimeEscapeHatches()[0]} for full source`,
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function fallbackDecision(
  hookEventName: CodexRuntimeHookInput["hookEventName"],
  filePath: string | undefined,
  statePath: string | undefined,
  reasons: string[],
  repeatedFile: boolean,
  eligible: boolean,
  escapeHatchUsed: boolean,
  fallbackReason: string,
  decision?: ReturnType<typeof decideCodexPreRead>,
): CodexRuntimeHookDecision {
  return {
    runtime: "codex",
    hookEventName,
    action: "fallback",
    filePath,
    reasons,
    statePath,
    debug: {
      repeatedFile,
      eligible,
      escapeHatchUsed,
      decision,
    },
    fallback: {
      action: "full-read",
      reason: fallbackReason,
    },
  };
}

export function handleCodexRuntimeHook(input: CodexRuntimeHookInput, cwd = process.cwd()): CodexRuntimeHookDecision {
  const hookEventName = input.hookEventName;
  const sessionKey = resolveCodexRuntimeSessionKey(input.sessionId, input.threadId);

  if (hookEventName === "SessionStart") {
    const statePath = initializeCodexRuntimeSession(cwd, sessionKey);
    return {
      runtime: "codex",
      hookEventName,
      action: "noop",
      reasons: [],
      statePath,
      debug: {
        repeatedFile: false,
        eligible: false,
        escapeHatchUsed: false,
      },
    };
  }

  if (hookEventName === "Stop") {
    const statePath = clearCodexRuntimeSession(cwd, sessionKey);
    return {
      runtime: "codex",
      hookEventName,
      action: "noop",
      reasons: [],
      statePath,
      debug: {
        repeatedFile: false,
        eligible: false,
        escapeHatchUsed: false,
      },
    };
  }

  const prompt = input.prompt ?? "";
  const target = extractPromptTarget(prompt, cwd);
  const escapeHatchUsed = hasFullReadEscapeHatch(prompt);

  if (!target) {
    return {
      runtime: "codex",
      hookEventName,
      action: "noop",
      reasons: ["no-eligible-file-in-prompt"],
      debug: {
        repeatedFile: false,
        eligible: false,
        escapeHatchUsed,
      },
    };
  }

  if (escapeHatchUsed) {
    return fallbackDecision(
      hookEventName,
      target,
      undefined,
      ["escape-hatch-full-read"],
      false,
      true,
      true,
      "escape-hatch-full-read",
    );
  }

  const { statePath, seenCount } = markCodexRuntimeSeenFile(cwd, sessionKey, target);
  const repeatedFile = seenCount >= 2;

  if (!repeatedFile) {
    return {
      runtime: "codex",
      hookEventName,
      action: "record",
      filePath: target,
      reasons: ["first-seen-file"],
      statePath,
      debug: {
        repeatedFile: false,
        eligible: true,
        escapeHatchUsed: false,
      },
    };
  }

  const decision = decideCodexPreRead(path.join(cwd, target), cwd);
  if (decision.decision === "payload" && decision.payload) {
    return {
      runtime: "codex",
      hookEventName,
      action: "inject",
      filePath: target,
      reasons: ["repeated-file"],
      statePath,
      additionalContext: buildAdditionalContext(target, decision.payload),
      debug: {
        repeatedFile: true,
        eligible: true,
        escapeHatchUsed: false,
        decision,
      },
    };
  }

  return fallbackDecision(
    hookEventName,
    target,
    statePath,
    decision.reasons,
    true,
    decision.eligible,
    false,
    decision.fallback?.reason ?? decision.reasons[0] ?? "raw-mode",
    decision,
  );
}
