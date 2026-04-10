import fs from "node:fs";
import path from "node:path";

const ELIGIBLE_EXTENSIONS = new Set([".tsx", ".jsx"]);
const ESCAPE_HATCH_TOKENS = ["#fxxks-full-read", "#fxxks-disable-pre-read"] as const;
const FILE_TOKEN_PATTERN = /(?:[A-Za-z]:)?[A-Za-z0-9_./\\-]+\.(?:tsx|jsx)\b/g;

function trimPromptToken(token: string): string {
  return token.replace(/^[`"'([{<]+/, "").replace(/[`"')\]}>:;,!?]+$/, "");
}

function normalizeCandidate(token: string, cwd: string): string | null {
  const cleaned = trimPromptToken(token);
  if (!cleaned) return null;

  const resolved = path.isAbsolute(cleaned) ? path.resolve(cleaned) : path.resolve(cwd, cleaned);
  const extension = path.extname(resolved).toLowerCase();
  if (!ELIGIBLE_EXTENSIONS.has(extension)) return null;
  if (!fs.existsSync(resolved)) return null;
  return path.relative(cwd, resolved) || path.basename(resolved);
}

export function extractPromptTarget(prompt: string, cwd = process.cwd()): string | null {
  for (const match of prompt.matchAll(FILE_TOKEN_PATTERN)) {
    const normalized = normalizeCandidate(match[0], cwd);
    if (normalized) return normalized;
  }
  return null;
}

export function hasFullReadEscapeHatch(prompt: string): boolean {
  return ESCAPE_HATCH_TOKENS.some((token) => prompt.includes(token));
}

export function codexRuntimeEscapeHatches(): readonly string[] {
  return ESCAPE_HATCH_TOKENS;
}
