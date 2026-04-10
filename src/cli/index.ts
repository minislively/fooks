#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ensureFeLensDirs, configPath } from "../core/paths";
import { scanProject } from "../core/scan";
import { discoverProjectFiles } from "../core/discover";
import { extractFile } from "../core/extract";
import { toModelFacingPayload } from "../core/payload/model-facing";
import { decideMode } from "../core/decide";
import { attachCodex } from "../adapters/codex";
import { attachClaude } from "../adapters/claude";
import { decideCodexPreRead } from "../adapters/codex-pre-read";
import { handleCodexRuntimeHook } from "../adapters/codex-runtime-hook";
import { handleCodexNativeHookPayload } from "../adapters/codex-native-hook";
import type { ExtractionResult } from "../core/schema";

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function requireFilePath(maybePath: string | undefined): string {
  if (!maybePath) {
    throw new Error("Missing file path argument");
  }
  const fullPath = path.resolve(maybePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${maybePath}`);
  }
  return fullPath;
}

function asBase(result: ExtractionResult): Omit<ExtractionResult, "mode"> {
  const { mode: _mode, ...rest } = result;
  return rest;
}

function resolveAttachSampleFile(cwd = process.cwd()): string {
  const target = discoverProjectFiles(cwd).find((item) => item.kind === "component");
  if (!target) {
    throw new Error("No React/TSX component file found for attach contract proof");
  }
  return target.filePath;
}

function parseExtractArgs(args: string[]): { filePath: string; modelPayload: boolean } {
  let filePath: string | undefined;
  let modelPayload = false;

  for (const arg of args) {
    if (arg === "--model-payload") {
      modelPayload = true;
      continue;
    }
    if (arg === "--json") {
      continue;
    }
    if (!filePath) {
      filePath = arg;
      continue;
    }
    throw new Error(`Unexpected extract argument: ${arg}`);
  }

  return { filePath: requireFilePath(filePath), modelPayload };
}

function parseCodexRuntimeHookArgs(args: string[]): {
  nativeHook: boolean;
  event: "SessionStart" | "UserPromptSubmit" | "Stop";
  prompt?: string;
  sessionId?: string;
  threadId?: string;
  turnId?: string;
} {
  let nativeHook = false;
  let event: "SessionStart" | "UserPromptSubmit" | "Stop" | undefined;
  let prompt: string | undefined;
  let sessionId: string | undefined;
  let threadId: string | undefined;
  let turnId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--json":
        break;
      case "--native-hook":
        nativeHook = true;
        break;
      case "--event":
        event = args[index + 1] as typeof event;
        index += 1;
        break;
      case "--prompt":
        prompt = args[index + 1];
        index += 1;
        break;
      case "--session-id":
        sessionId = args[index + 1];
        index += 1;
        break;
      case "--thread-id":
        threadId = args[index + 1];
        index += 1;
        break;
      case "--turn-id":
        turnId = args[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`Unexpected codex-runtime-hook argument: ${arg}`);
    }
  }

  if (nativeHook) {
    return { nativeHook, event: "SessionStart", prompt, sessionId, threadId, turnId };
  }

  if (event !== "SessionStart" && event !== "UserPromptSubmit" && event !== "Stop") {
    throw new Error("codex-runtime-hook requires --event <SessionStart|UserPromptSubmit|Stop>");
  }

  return { nativeHook, event, prompt, sessionId, threadId, turnId };
}

async function readStdinJson(): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

async function run(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const [arg1] = rest;
  const cliName = path.basename(process.argv[1] ?? "fxxks");

  switch (command) {
    case "init": {
      ensureFeLensDirs();
      const config = configPath();
      if (!fs.existsSync(config)) {
        fs.writeFileSync(
          config,
          JSON.stringify(
            {
              version: 1,
              createdAt: new Date().toISOString(),
              targetAccount: process.env.FE_LENS_TARGET_ACCOUNT ?? "minislively",
            },
            null,
            2,
          ),
        );
      }
      print({ config, cacheDir: path.join(process.cwd(), ".fe-lens", "cache") });
      return;
    }
    case "scan": {
      ensureFeLensDirs();
      const result = scanProject();
      print(result);
      return;
    }
    case "extract": {
      const { filePath: file, modelPayload } = parseExtractArgs(rest);
      const result = extractFile(file);
      print(modelPayload ? toModelFacingPayload(result) : result);
      return;
    }
    case "decide": {
      const file = requireFilePath(arg1);
      const extracted = extractFile(file);
      const result = decideMode(asBase(extracted));
      print({ filePath: file, ...result });
      return;
    }
    case "attach": {
      const runtime = arg1;
      if (runtime !== "codex" && runtime !== "claude") {
        throw new Error("attach expects 'codex' or 'claude'");
      }
      const sampleFile = resolveAttachSampleFile();
      const result = runtime === "codex" ? attachCodex(sampleFile) : attachClaude(sampleFile);
      print(result);
      return;
    }
    case "codex-pre-read": {
      const file = requireFilePath(arg1);
      print(decideCodexPreRead(file, process.cwd()));
      return;
    }
    case "codex-runtime-hook": {
      const options = parseCodexRuntimeHookArgs(rest);
      if (options.nativeHook) {
        const payload = await readStdinJson();
        const output = handleCodexNativeHookPayload(payload, process.cwd());
        if (output) {
          print(output);
        }
        return;
      }
      print(
        handleCodexRuntimeHook(
          {
            hookEventName: options.event,
            prompt: options.prompt,
            sessionId: options.sessionId,
            threadId: options.threadId,
            turnId: options.turnId,
          },
          process.cwd(),
        ),
      );
      return;
    }
    default:
      console.error(`Unknown command: ${command ?? "<none>"}`);
      console.error(`Usage: ${cliName} <init|scan|extract|decide|attach|codex-pre-read|codex-runtime-hook>`);
      console.error(`       ${cliName} extract <file> [--model-payload] [--json]`);
      console.error(`       ${cliName} codex-pre-read <file> [--json]`);
      console.error(`       ${cliName} codex-runtime-hook --event <SessionStart|UserPromptSubmit|Stop> [--session-id <id>] [--prompt <text>] [--json]`);
      console.error(`       ${cliName} codex-runtime-hook --native-hook`);
      process.exitCode = 1;
  }
}

void run();
