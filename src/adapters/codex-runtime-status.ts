import type { OutputMode } from "../core/schema";

export function buildPreReadReuseStatus(mode: OutputMode): string {
  return `fxxks: reused pre-read (${mode})`;
}

export function buildFullReadRequestedStatus(): string {
  return "fxxks: full read requested";
}

export function buildFallbackStatus(reason: string): string {
  return `fxxks: fallback (${reason})`;
}
