import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CODEX_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "Stop"] as const;
const DEFAULT_COMMAND = "fxxks codex-runtime-hook --native-hook";

type CodexHookEvent = (typeof CODEX_HOOK_EVENTS)[number];

type HookCommand = {
  type: "command";
  command: string;
  statusMessage?: string;
  timeout?: number;
};

type HookMatcher = {
  matcher?: string;
  hooks: HookCommand[];
};

type HooksFile = {
  hooks?: Record<string, HookMatcher[]>;
};

export type CodexHookPresetInstallResult = {
  hooksPath: string;
  backupPath?: string;
  command: string;
  created: boolean;
  modified: boolean;
  installedEvents: CodexHookEvent[];
  skippedEvents: CodexHookEvent[];
};

function runtimeHome(): string {
  return process.env.FE_LENS_CODEX_HOME || path.join(os.homedir(), ".codex");
}

function hooksPath(): string {
  return path.join(runtimeHome(), "hooks.json");
}

function starterMatcher(event: CodexHookEvent): HookMatcher {
  const command: HookCommand = { type: "command", command: DEFAULT_COMMAND };
  if (event === "SessionStart") {
    return { matcher: "startup|resume", hooks: [command] };
  }
  return { hooks: [command] };
}

function readHooksFile(filePath: string): HooksFile {
  if (!fs.existsSync(filePath)) return { hooks: {} };
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as HooksFile;
  return { hooks: parsed.hooks ?? {} };
}

function matcherContainsCommand(matcher: HookMatcher, command: string): boolean {
  return Array.isArray(matcher.hooks) && matcher.hooks.some((hook) => hook?.type === "command" && hook.command === command);
}

function ensureEventHook(hooksFile: HooksFile, event: CodexHookEvent, command: string): boolean {
  const eventHooks = hooksFile.hooks?.[event] ?? [];
  if (eventHooks.some((matcher) => matcherContainsCommand(matcher, command))) {
    hooksFile.hooks![event] = eventHooks;
    return false;
  }
  hooksFile.hooks![event] = [starterMatcher(event), ...eventHooks];
  return true;
}

export function installCodexHookPreset(): CodexHookPresetInstallResult {
  const filePath = hooksPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const created = !fs.existsSync(filePath);
  const existingRaw = created ? "" : fs.readFileSync(filePath, "utf8");
  const hooksFile = readHooksFile(filePath);
  hooksFile.hooks ||= {};

  const installedEvents: CodexHookEvent[] = [];
  const skippedEvents: CodexHookEvent[] = [];

  for (const event of CODEX_HOOK_EVENTS) {
    if (ensureEventHook(hooksFile, event, DEFAULT_COMMAND)) {
      installedEvents.push(event);
    } else {
      skippedEvents.push(event);
    }
  }

  const nextRaw = `${JSON.stringify(hooksFile, null, 2)}\n`;
  const modified = existingRaw !== nextRaw;
  let backupPath: string | undefined;
  if (modified && !created) {
    backupPath = `${filePath}.bak-${Math.floor(Date.now() / 1000)}`;
    fs.copyFileSync(filePath, backupPath);
  }
  if (modified) {
    fs.writeFileSync(filePath, nextRaw);
  }

  return {
    hooksPath: filePath,
    backupPath,
    command: DEFAULT_COMMAND,
    created,
    modified,
    installedEvents,
    skippedEvents,
  };
}
