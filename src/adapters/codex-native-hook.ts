import fs from "node:fs";
import path from "node:path";
import { handleCodexRuntimeHook } from "./codex-runtime-hook";
import { buildFallbackStatus, buildFullReadRequestedStatus } from "./codex-runtime-status";
import type { CodexNativeHookOutput, CodexRuntimeHookEvent, CodexRuntimeHookInput } from "../core/schema";

type NativePayload = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readHookEventName(payload: NativePayload): CodexRuntimeHookEvent | null {
  const raw = safeString(payload.hook_event_name ?? payload.hookEventName ?? payload.event ?? payload.name).trim();
  if (raw === "SessionStart" || raw === "UserPromptSubmit" || raw === "Stop") {
    return raw;
  }
  return null;
}

function readPrompt(payload: NativePayload): string {
  const candidates = [
    payload.prompt,
    payload.input,
    payload.user_prompt,
    payload.userPrompt,
    payload.text,
  ];
  for (const candidate of candidates) {
    const value = safeString(candidate).trim();
    if (value) return value;
  }
  return "";
}

function findAttachedProjectRoot(startCwd: string): string | null {
  let current = path.resolve(startCwd);
  while (true) {
    if (fs.existsSync(path.join(current, ".fe-lens", "adapters", "codex", "adapter.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function buildFallbackAdditionalContext(filePath: string | undefined, reason: string): string {
  const target = filePath ?? "requested frontend file";
  const leadLine = reason === "escape-hatch-full-read"
    ? buildFullReadRequestedStatus()
    : buildFallbackStatus(reason);
  return `${leadLine} · file: ${target} · Read the full source file for this turn.`;
}

function toHookSpecificOutput(hookEventName: CodexRuntimeHookEvent, additionalContext: string): CodexNativeHookOutput {
  return {
    hookSpecificOutput: {
      hookEventName,
      additionalContext,
    },
  };
}

export function handleCodexNativeHookPayload(payload: NativePayload, fallbackCwd = process.cwd()): CodexNativeHookOutput | null {
  const hookEventName = readHookEventName(payload);
  if (!hookEventName) return null;

  const payloadCwd = safeString(payload.cwd).trim() || fallbackCwd;
  const projectRoot = findAttachedProjectRoot(payloadCwd);
  if (!projectRoot) return null;

  const input: CodexRuntimeHookInput = {
    hookEventName,
    prompt: hookEventName === "UserPromptSubmit" ? readPrompt(payload) : undefined,
    sessionId: safeString(payload.session_id ?? payload.sessionId) || undefined,
    threadId: safeString(payload.thread_id ?? payload.threadId) || undefined,
    turnId: safeString(payload.turn_id ?? payload.turnId) || undefined,
    cwd: projectRoot,
  };

  const decision = handleCodexRuntimeHook(input, projectRoot);
  if (decision.action === "inject" && decision.additionalContext) {
    return toHookSpecificOutput(hookEventName, decision.additionalContext);
  }

  if (decision.action === "fallback" && hookEventName === "UserPromptSubmit") {
    return toHookSpecificOutput(
      hookEventName,
      buildFallbackAdditionalContext(decision.filePath, decision.fallback?.reason ?? decision.reasons[0] ?? "full-read"),
    );
  }

  return null;
}
