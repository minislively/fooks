import path from "node:path";
import fs from "node:fs";

export const FE_LENS_DIR = ".fe-lens";

export function projectRoot(cwd = process.cwd()): string {
  return cwd;
}

export function ensureFeLensDirs(cwd = process.cwd()): void {
  fs.mkdirSync(path.join(cwd, FE_LENS_DIR, "cache"), { recursive: true });
  fs.mkdirSync(path.join(cwd, FE_LENS_DIR, "adapters"), { recursive: true });
}

export function configPath(cwd = process.cwd()): string {
  return path.join(cwd, FE_LENS_DIR, "config.json");
}

export function indexPath(cwd = process.cwd()): string {
  return path.join(cwd, FE_LENS_DIR, "index.json");
}

export function cacheFilePath(hash: string, cwd = process.cwd()): string {
  return path.join(cwd, FE_LENS_DIR, "cache", `${hash}.json`);
}

export function adapterDir(runtime: "codex" | "claude", cwd = process.cwd()): string {
  return path.join(cwd, FE_LENS_DIR, "adapters", runtime);
}

export function runtimeStatusPath(runtime: "codex" | "claude", cwd = process.cwd()): string {
  return path.join(adapterDir(runtime, cwd), "status.json");
}
