import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CODEX_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "Stop"] as const;
const CODEX_HOOK_SUFFIX = "codex-runtime-hook --native-hook";

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

export function defaultCodexHookCommand(cliName = "fooks"): string {
  return `${cliName} ${CODEX_HOOK_SUFFIX}`;
}

function compatibleCodexHookCommands(cliName = "fooks"): string[] {
  return [...new Set([defaultCodexHookCommand(cliName), defaultCodexHookCommand("fooks")])];
}

function isLegacyNodeBridgeCommand(commandText: string): boolean {
  return /^node\s+(?:"[^"]+\/dist\/cli\/index\.js"|'[^']+\/dist\/cli\/index\.js'|\S+\/dist\/cli\/index\.js)\s+codex-runtime-hook --native-hook$/.test(commandText);
}

function isCompatibleCodexHookCommand(commandText: string, cliName = "fooks"): boolean {
  return compatibleCodexHookCommands(cliName).includes(commandText) || isLegacyNodeBridgeCommand(commandText);
}

function runtimeHome(): string {
  return process.env.FOOKS_CODEX_HOME || path.join(os.homedir(), ".codex");
}

function hooksPath(): string {
  return path.join(runtimeHome(), "hooks.json");
}

function starterMatcher(event: CodexHookEvent, commandText: string): HookMatcher {
  const command: HookCommand = { type: "command", command: commandText };
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

function findCompatibleCommandHook(matcher: HookMatcher, cliName = "fooks"): HookCommand | undefined {
  if (!Array.isArray(matcher.hooks)) return undefined;
  return matcher.hooks.find((hook) => hook?.type === "command" && isCompatibleCodexHookCommand(hook.command, cliName));
}

function ensureEventHook(hooksFile: HooksFile, event: CodexHookEvent, command: string): boolean {
  const eventHooks = hooksFile.hooks?.[event] ?? [];
  const cliName = command.split(" ")[0];
  const existingHook = eventHooks.map((matcher) => findCompatibleCommandHook(matcher, cliName)).find(Boolean);
  if (existingHook) {
    existingHook.command = command;
    hooksFile.hooks![event] = eventHooks;
    return false;
  }
  hooksFile.hooks![event] = [starterMatcher(event, command), ...eventHooks];
  return true;
}

export function installCodexHookPreset(cliName = "fooks"): CodexHookPresetInstallResult {
  const filePath = hooksPath();
  const command = defaultCodexHookCommand(cliName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const created = !fs.existsSync(filePath);
  const existingRaw = created ? "" : fs.readFileSync(filePath, "utf8");
  const hooksFile = readHooksFile(filePath);
  hooksFile.hooks ||= {};

  const installedEvents: CodexHookEvent[] = [];
  const skippedEvents: CodexHookEvent[] = [];

  for (const event of CODEX_HOOK_EVENTS) {
    if (ensureEventHook(hooksFile, event, command)) {
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
    command,
    created,
    modified,
    installedEvents,
    skippedEvents,
  };
}
