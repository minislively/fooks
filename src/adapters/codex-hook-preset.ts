import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CODEX_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "Stop"] as const;

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
  return `${cliName} codex-runtime-hook --native-hook`;
}

function compatibleCodexHookCommands(cliName = "fooks"): string[] {
  return [...new Set([defaultCodexHookCommand(cliName), defaultCodexHookCommand("fooks"), defaultCodexHookCommand("fxxks"), defaultCodexHookCommand("fe-lens")])];
}

function runtimeHome(): string {
  return process.env.FE_LENS_CODEX_HOME || path.join(os.homedir(), ".codex");
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

function matcherContainsCommand(matcher: HookMatcher, commands: string[]): boolean {
  return Array.isArray(matcher.hooks) && matcher.hooks.some((hook) => hook?.type === "command" && commands.includes(hook.command));
}

function ensureEventHook(hooksFile: HooksFile, event: CodexHookEvent, command: string): boolean {
  const eventHooks = hooksFile.hooks?.[event] ?? [];
  if (eventHooks.some((matcher) => matcherContainsCommand(matcher, compatibleCodexHookCommands(command.split(" ")[0])))) {
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
