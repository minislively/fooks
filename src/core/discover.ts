import fs from "node:fs";
import path from "node:path";

const IGNORE = new Set([".git", "node_modules", "dist", ".omx", ".fe-lens"]);
const COMPONENT_EXTS = new Set([".tsx", ".jsx"]);

export type FileTarget = {
  filePath: string;
  kind: "component" | "linked-ts";
};

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    out.push(full);
  }
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function resolveRelativeImport(fromFile: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.jsx"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

type RelativeImport = {
  resolved: string;
  isTypeOnly: boolean;
};

function relativeImports(filePath: string): RelativeImport[] {
  const text = readText(filePath);
  const matches = text.matchAll(/import\s+(type\s+)?(?:[\s\S]*?)from\s+["'](\.[^"']+)["']|import\s+["'](\.[^"']+)["']/g);
  const imports = new Map<string, RelativeImport>();
  for (const match of matches) {
    const specifier = match[2] ?? match[3];
    if (!specifier) continue;
    const resolved = resolveRelativeImport(filePath, specifier);
    if (resolved) {
      imports.set(resolved, {
        resolved,
        isTypeOnly: Boolean(match[1]),
      });
    }
  }
  return [...imports.values()];
}

function isQualifyingLinkedTs(filePath: string, componentFile: string, isTypeOnly: boolean): boolean {
  if (path.dirname(filePath) !== path.dirname(componentFile)) {
    return false;
  }
  if (isTypeOnly) return true;
  const base = path.basename(filePath).toLowerCase();
  const componentStem = path.basename(componentFile, path.extname(componentFile)).toLowerCase();
  const isNamedContractFile =
    base.endsWith(".types.ts") ||
    base.endsWith(".props.ts") ||
    base.endsWith(".interface.ts") ||
    base.endsWith(".interfaces.ts") ||
    base.endsWith(".config.ts");
  const isComponentScopedUtility =
    (base.endsWith(".util.ts") || base.endsWith(".utils.ts") || base.endsWith(".helper.ts") || base.endsWith(".helpers.ts")) &&
    base.startsWith(componentStem);

  return isNamedContractFile || isComponentScopedUtility;
}

export function discoverProjectFiles(cwd = process.cwd()): FileTarget[] {
  const allFiles: string[] = [];
  walk(cwd, allFiles);
  const componentFiles = allFiles.filter((file) => COMPONENT_EXTS.has(path.extname(file)));
  const linkedTs = new Set<string>();

  for (const componentFile of componentFiles) {
    for (const imported of relativeImports(componentFile)) {
      if (path.extname(imported.resolved) === ".ts" && isQualifyingLinkedTs(imported.resolved, componentFile, imported.isTypeOnly)) {
        linkedTs.add(imported.resolved);
      }
    }
  }

  return [
    ...componentFiles.sort().map((filePath) => ({ filePath, kind: "component" as const })),
    ...[...linkedTs].sort().map((filePath) => ({ filePath, kind: "linked-ts" as const })),
  ];
}
