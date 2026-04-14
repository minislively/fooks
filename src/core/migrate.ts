import fs from "node:fs";
import path from "node:path";
import { canonicalProjectDataDir, legacyProjectDataDir } from "./paths";

type ProjectStateMigrationResult =
  | {
      action: "noop";
      reason: "no-legacy-project-state";
      legacyDir: string;
      canonicalDir: string;
      copiedPaths: string[];
      skippedPaths: string[];
    }
  | {
      action: "renamed-legacy";
      legacyDir: string;
      canonicalDir: string;
      copiedPaths: string[];
      skippedPaths: string[];
    }
  | {
      action: "merged-legacy";
      legacyDir: string;
      canonicalDir: string;
      copiedPaths: string[];
      skippedPaths: string[];
    };

function walkRelativeFiles(root: string, current = root): string[] {
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRelativeFiles(root, full));
      continue;
    }
    files.push(path.relative(root, full));
  }
  return files.sort();
}

export function migrateProjectState(cwd = process.cwd()): ProjectStateMigrationResult {
  const legacyDir = legacyProjectDataDir(cwd);
  const canonicalDir = canonicalProjectDataDir(cwd);

  if (!fs.existsSync(legacyDir)) {
    return {
      action: "noop",
      reason: "no-legacy-project-state",
      legacyDir,
      canonicalDir,
      copiedPaths: [],
      skippedPaths: [],
    };
  }

  if (!fs.existsSync(canonicalDir)) {
    fs.renameSync(legacyDir, canonicalDir);
    return {
      action: "renamed-legacy",
      legacyDir,
      canonicalDir,
      copiedPaths: walkRelativeFiles(canonicalDir).map((relativePath) => path.join(".fooks", relativePath)),
      skippedPaths: [],
    };
  }

  const copiedPaths: string[] = [];
  const skippedPaths: string[] = [];
  for (const relativePath of walkRelativeFiles(legacyDir)) {
    const legacyFile = path.join(legacyDir, relativePath);
    const canonicalFile = path.join(canonicalDir, relativePath);
    if (fs.existsSync(canonicalFile)) {
      skippedPaths.push(path.join(".fooks", relativePath));
      continue;
    }
    fs.mkdirSync(path.dirname(canonicalFile), { recursive: true });
    fs.copyFileSync(legacyFile, canonicalFile);
    copiedPaths.push(path.join(".fooks", relativePath));
  }

  return {
    action: "merged-legacy",
    legacyDir,
    canonicalDir,
    copiedPaths,
    skippedPaths,
  };
}
