import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { readClaudeRuntimeStatus } from "../adapters/claude-status.js";
import { canonicalProjectDataDir } from "../core/paths.js";
import { CacheMonitor } from "../core/cache-monitor.js";

type CheckStatus = "pass" | "fail" | "warn";

interface DoctorCheck {
  name: string;
  status: CheckStatus;
  message: string;
  fix?: string;
}

interface DoctorResult {
  checks: DoctorCheck[];
  summary: { pass: number; fail: number; warn: number };
  healthy: boolean;
}

function hasEligibleFiles(cwd: string): boolean {
  try {
    const result = execSync("find . -maxdepth 3 -name '*.tsx' -o -name '*.jsx' | head -1", { cwd, encoding: "utf8", shell: "/bin/sh" });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function hasTypeScriptLsp(): boolean {
  try {
    execSync("command -v typescript-language-server", { encoding: "utf8", shell: "/bin/sh" });
    return true;
  } catch {
    return false;
  }
}

export function runDoctor(cwd = process.cwd()): DoctorResult {
  const checks: DoctorCheck[] = [];

  // 1. Claude adapter
  const claudeStatus = readClaudeRuntimeStatus(cwd);
  checks.push({
    name: "Claude adapter",
    status: claudeStatus.adapter.installed ? "pass" : "fail",
    message: claudeStatus.adapter.installed ? "Adapter metadata and context template are present" : "Adapter is not installed",
    fix: claudeStatus.adapter.installed ? undefined : "Run: fooks attach claude",
  });

  // 2. Claude manifest
  const manifestOk = claudeStatus.manifest.valid === true;
  checks.push({
    name: "Claude runtime manifest",
    status: manifestOk ? "pass" : "fail",
    message: manifestOk ? "Manifest matches this project" : claudeStatus.manifest.blocker ?? "Manifest is missing or invalid",
    fix: manifestOk ? undefined : "Run: fooks attach claude",
  });

  // 3. Claude hooks
  const hooksOk = claudeStatus.hooks.ready;
  checks.push({
    name: "Claude project-local hooks",
    status: hooksOk ? "pass" : claudeStatus.hooks.exists ? "warn" : "fail",
    message: hooksOk
      ? `Hooks ready: ${claudeStatus.hooks.installedEvents.join(", ")}`
      : claudeStatus.hooks.exists
        ? `Partial: installed [${claudeStatus.hooks.installedEvents.join(", ")}], missing [${claudeStatus.hooks.missingEvents.join(", ")}]`
        : "Local settings file is missing",
    fix: hooksOk ? undefined : "Run: fooks install claude-hooks",
  });

  // 4. Cache health
  try {
    const monitor = new CacheMonitor(canonicalProjectDataDir(cwd));
    const cacheReport = monitor.healthReport();
    checks.push({
      name: "Cache health",
      status: cacheReport.status === "healthy" ? "pass" : cacheReport.status === "empty" ? "warn" : "fail",
      message: `Status: ${cacheReport.status}, entries: ${cacheReport.entryCount}`,
      fix: cacheReport.status === "corrupted" ? "Run: fooks scan (cache will rebuild)" : undefined,
    });
  } catch {
    checks.push({
      name: "Cache health",
      status: "warn",
      message: "Unable to read cache",
    });
  }

  // 5. Eligible files
  const eligible = hasEligibleFiles(cwd);
  checks.push({
    name: "Eligible source files",
    status: eligible ? "pass" : "warn",
    message: eligible ? "Found .tsx/.jsx files in project" : "No .tsx/.jsx files found (fooks targets React/TSX)",
    fix: eligible ? undefined : "Ensure your project has React components",
  });

  // 6. TypeScript LSP (optional)
  const lspOk = hasTypeScriptLsp();
  checks.push({
    name: "TypeScript language server",
    status: lspOk ? "pass" : "warn",
    message: lspOk ? "typescript-language-server is available" : "Not installed (optional, improves IDE experience)",
    fix: lspOk ? undefined : "Install: npm install -g typescript-language-server typescript",
  });

  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    warn: checks.filter((c) => c.status === "warn").length,
  };

  return { checks, summary, healthy: summary.fail === 0 };
}

export function printDoctor(result: DoctorResult): void {
  console.log("fooks doctor\n");
  for (const check of result.checks) {
    const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.message}`);
    if (check.fix) {
      console.log(`   Fix: ${check.fix}`);
    }
    console.log();
  }
  const { pass, fail, warn } = result.summary;
  const overall = fail > 0 ? "🔴 Unhealthy" : warn > 0 ? "🟡 Healthy with warnings" : "🟢 Healthy";
  console.log(`Summary: ${pass} passed, ${warn} warnings, ${fail} failures`);
  console.log(`Overall: ${overall}`);
}
