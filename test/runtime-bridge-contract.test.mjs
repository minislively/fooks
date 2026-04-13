import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const { handleCodexRuntimeHook } = await import(path.join(repoRoot, "dist", "adapters", "codex-runtime-hook.js"));

test("runtime bridge contract keeps repeated-read inject and fallback semantics stable", () => {
  const injectSession = `bridge-contract-inject-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: injectSession }, repoRoot);

  const firstInject = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: injectSession,
      prompt: "Please update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );
  const secondInject = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: injectSession,
      prompt: "Again, update fixtures/compressed/FormSection.tsx",
    },
    repoRoot,
  );

  assert.equal(firstInject.action, "record");
  assert.equal(secondInject.action, "inject");
  assert.match(secondInject.additionalContext, /^fooks: reused pre-read \(compressed\)/);

  const fallbackSession = `bridge-contract-fallback-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: fallbackSession }, repoRoot);

  const firstFallback = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: fallbackSession,
      prompt: "Please inspect fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );
  const secondFallback = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: fallbackSession,
      prompt: "Again, inspect fixtures/raw/SimpleButton.tsx",
    },
    repoRoot,
  );

  assert.equal(firstFallback.action, "record");
  assert.equal(secondFallback.action, "fallback");
  assert.equal(secondFallback.fallback.reason, "raw-mode");

  const overrideSession = `bridge-contract-override-${Date.now()}`;
  handleCodexRuntimeHook({ hookEventName: "SessionStart", sessionId: overrideSession }, repoRoot);
  const override = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: overrideSession,
      prompt: "Need exact source fixtures/compressed/FormSection.tsx #fooks-full-read",
    },
    repoRoot,
  );

  assert.equal(override.action, "fallback");
  assert.equal(override.fallback.reason, "escape-hatch-full-read");

  const legacyOverride = handleCodexRuntimeHook(
    {
      hookEventName: "UserPromptSubmit",
      sessionId: overrideSession,
      prompt: "Need exact source fixtures/compressed/FormSection.tsx #fxxks-full-read",
    },
    repoRoot,
  );

  assert.equal(legacyOverride.action, "fallback");
  assert.equal(legacyOverride.fallback.reason, "escape-hatch-full-read");
});
