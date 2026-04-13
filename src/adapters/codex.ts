import { scanProject } from "../core/scan";
import { extractFile } from "../core/extract";
import { detectAccountContext, finalizeAttach, installRuntimeManifest } from "./shared";
import { codexRuntimeEscapeHatches } from "./codex-runtime-prompt";
import { completeCodexInitialScan, initializeCodexTrustStatus } from "./codex-runtime-trust";
import type { AttachResult } from "../core/schema";

export function attachCodex(sampleFile: string, cwd = process.cwd()): AttachResult {
  initializeCodexTrustStatus(cwd);
  const scan = scanProject(cwd);
  const trustStatus = completeCodexInitialScan(scan.scannedAt, cwd);
  const sample = extractFile(sampleFile);
  const account = detectAccountContext(cwd);
  const attemptedAt = new Date().toISOString();
  const runtimeProof =
    account.account !== "minislively"
      ? {
          status: "blocked" as const,
          attemptedAt,
          details: ["codex adapter artifacts created", `detected-account=${account.account}`, `account-source=${account.source}`],
          blocker: "minislively account context not detected",
        }
      : (() => {
          const manifestPath = installRuntimeManifest("codex", cwd, {
            runtimeBridge: {
              command: "fxxks codex-runtime-hook --native-hook",
              supportedHookEvents: ["SessionStart", "UserPromptSubmit", "Stop"],
              scope: {
                extensions: [".tsx", ".jsx"],
                strategy: "session-repeated-read",
              },
              escapeHatches: [...codexRuntimeEscapeHatches()],
            },
          });
          if (!manifestPath) {
            return {
              status: "blocked" as const,
              attemptedAt,
              details: ["codex adapter artifacts created", `account-source=${account.source}`, "runtime-manifest-write-attempted=false"],
              blocker: "Codex runtime home not detected",
            };
          }

          return {
            status: "passed" as const,
            attemptedAt,
            artifactPath: manifestPath,
            details: [`account-context=${account.account}`, `account-source=${account.source}`, `runtime-manifest=${manifestPath}`, "codex adapter artifacts created"],
          };
        })();
  return finalizeAttach("codex", sample, runtimeProof, cwd, trustStatus);
}
