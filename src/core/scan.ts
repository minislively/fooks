import path from "node:path";
import { discoverProjectFiles } from "./discover";
import { hashText } from "./hash";
import { readCachedExtraction, writeCachedExtraction, writeScanIndex } from "./cache";
import { extractFile } from "./extract";
import type { IndexEntry, ScanResult } from "./schema";
import fs from "node:fs";

export function scanProject(cwd = process.cwd()): ScanResult {
  const targets = discoverProjectFiles(cwd);
  const files: IndexEntry[] = [];
  let reusedCacheEntries = 0;
  let refreshedEntries = 0;

  for (const target of targets) {
    const text = fs.readFileSync(target.filePath, "utf8");
    const hash = hashText(text);
    const cached = readCachedExtraction(hash, cwd);
    const extracted = cached ?? extractFile(target.filePath);
    if (cached) {
      reusedCacheEntries += 1;
    } else {
      refreshedEntries += 1;
      writeCachedExtraction(extracted, cwd);
    }

    files.push({
      filePath: path.relative(cwd, target.filePath),
      fileHash: extracted.fileHash,
      componentName: extracted.componentName,
      exports: extracted.exports,
      propsSummary: extracted.contract?.propsSummary,
      hooks: extracted.behavior?.hooks ?? [],
      styleSystem: extracted.style?.system ?? "unknown",
      mode: extracted.mode,
      kind: target.kind,
    });
  }

  const result: ScanResult = {
    projectRoot: cwd,
    scannedAt: new Date().toISOString(),
    files,
    reusedCacheEntries,
    refreshedEntries,
  };
  writeScanIndex(result, cwd);
  return result;
}
