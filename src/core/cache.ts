import fs from "node:fs";
import path from "node:path";
import { cacheFilePath, canonicalProjectDataDir, ensureFeLensDirs, indexPath, legacyProjectDataDir } from "./paths";
import type { ExtractionResult, ScanResult } from "./schema";

function existingCachePath(hash: string, cwd: string): string | null {
  const candidates = [
    path.join(canonicalProjectDataDir(cwd), "cache", `${hash}.json`),
    path.join(legacyProjectDataDir(cwd), "cache", `${hash}.json`),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? null;
}

export function readCachedExtraction(hash: string, cwd = process.cwd()): ExtractionResult | null {
  const file = existingCachePath(hash, cwd);
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as ExtractionResult;
}

export function writeCachedExtraction(result: ExtractionResult, cwd = process.cwd()): void {
  ensureFeLensDirs(cwd);
  const file = cacheFilePath(result.fileHash, cwd);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

export function writeScanIndex(result: ScanResult, cwd = process.cwd()): void {
  ensureFeLensDirs(cwd);
  fs.writeFileSync(indexPath(cwd), JSON.stringify(result, null, 2));
}

export function readScanIndex(cwd = process.cwd()): ScanResult | null {
  const file = [indexPath(cwd), path.join(legacyProjectDataDir(cwd), "index.json")].find((candidate) => fs.existsSync(candidate));
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as ScanResult;
}

export function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
