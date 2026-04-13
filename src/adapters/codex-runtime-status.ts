import type { OutputMode } from "../core/schema";

export function buildPreReadReuseStatus(mode: OutputMode): string {
  return `fooks: reused pre-read (${mode})`;
}

export function buildFullReadRequestedStatus(): string {
  return "fooks: full read requested";
}

export function buildFallbackStatus(reason: string): string {
  return `fooks: fallback (${reason})`;
}
