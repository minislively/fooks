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

function run(): void {
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
    default:
      console.error(`Unknown command: ${command ?? "<none>"}`);
      console.error(`Usage: ${cliName} <init|scan|extract|decide|attach|codex-pre-read>`);
      console.error(`       ${cliName} extract <file> [--model-payload] [--json]`);
      console.error(`       ${cliName} codex-pre-read <file> [--json]`);
      process.exitCode = 1;
  }
}

run();
