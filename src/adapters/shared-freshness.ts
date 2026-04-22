import fs from "node:fs";

export function getFileMtimeMs(absolutePath: string): number | undefined {
  try {
    return fs.statSync(absolutePath).mtimeMs;
  } catch {
    return undefined;
  }
}

export function hasFileChanged(priorMtime: number | undefined, currentMtime: number | undefined): boolean {
  return priorMtime !== undefined && currentMtime !== undefined && priorMtime !== currentMtime;
}
