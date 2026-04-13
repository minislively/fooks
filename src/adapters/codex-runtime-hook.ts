import path from "node:path";
import { decideCodexPreRead } from "./codex-pre-read";
import { codexRuntimeEscapeHatches, hasFullReadEscapeHatch, resolvePromptFileContext } from "./codex-runtime-prompt";
import { buildPreReadReuseStatus } from "./codex-runtime-status";
import { clearCodexActiveFile, ensureFreshCodexContextForTarget, markCodexAttachPrepared, markCodexReady } from "./codex-runtime-trust";
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
    markCodexReady(cwd);
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
    clearCodexActiveFile(cwd);
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
  const promptContext = resolvePromptFileContext(prompt, cwd);
  const target = promptContext.filePath;
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
    markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
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

  const freshness = ensureFreshCodexContextForTarget(target, cwd);
  const { statePath, seenCount } = markCodexRuntimeSeenFile(cwd, sessionKey, target);
  const repeatedFile = seenCount >= 2;

  if (!repeatedFile) {
    markCodexReady(cwd);
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
    markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
    return {
      runtime: "codex",
      hookEventName,
      action: "inject",
      filePath: target,
      reasons: freshness.refreshed ? ["repeated-file", "refreshed-before-attach"] : ["repeated-file"],
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

  markCodexAttachPrepared({ filePath: target, source: "prompt-target" }, cwd);
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
