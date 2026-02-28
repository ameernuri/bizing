#!/usr/bin/env node

/**
 * docs-sync-check
 *
 * Guards against behavior changes without codebase documentation updates.
 *
 * Scope:
 * - Checks tracked git changes in this repo.
 * - If code-like files changed, requires at least one change under `docs/`.
 *
 * Notes:
 * - Mind files live outside this repo (`/Users/ameer/bizing/mind`), so this
 *   script cannot verify those edits directly. That requirement is enforced by
 *   process (`docs/DOC_SYNC.md` and `AGENTS.md`).
 */

import { execSync } from "node:child_process";

const EXEC_OPTIONS = {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
};

const DIFF_TARGET =
  "git diff --name-only -- . ':(exclude)testing/sagas/reports/**' ':(exclude)testing/sagas/runs/**'";
const DIFF_TARGET_STAGED =
  "git diff --cached --name-only -- . ':(exclude)testing/sagas/reports/**' ':(exclude)testing/sagas/runs/**'";

function getChangedFiles() {
  // Prefer staged changes when available, else use working tree.
  const staged = execSync(DIFF_TARGET_STAGED, EXEC_OPTIONS)
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  const untracked = execSync("git ls-files --others --exclude-standard", EXEC_OPTIONS)
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
    .filter(
      (path) =>
        !path.startsWith("testing/sagas/reports/") && !path.startsWith("testing/sagas/runs/"),
    );

  if (staged.length > 0) return Array.from(new Set([...staged, ...untracked]));

  const unstaged = execSync(DIFF_TARGET, EXEC_OPTIONS)
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  return Array.from(new Set([...unstaged, ...untracked]));
}

function isCodeFile(path) {
  if (path.startsWith("docs/")) return false;
  if (path.startsWith("testing/sagas/docs/")) return false;
  return /\.(ts|tsx|js|mjs|cjs|sql|json)$/.test(path);
}

function isDocsFile(path) {
  return path.startsWith("docs/") && path.endsWith(".md");
}

const changedFiles = getChangedFiles();

if (changedFiles.length === 0) {
  console.log("[docs-sync-check] No changed files.");
  process.exit(0);
}

const codeFiles = changedFiles.filter(isCodeFile);
const docsFiles = changedFiles.filter(isDocsFile);

if (codeFiles.length === 0) {
  console.log("[docs-sync-check] No code behavior files changed.");
  process.exit(0);
}

if (docsFiles.length > 0) {
  console.log(
    `[docs-sync-check] OK: ${codeFiles.length} code file(s) and ${docsFiles.length} docs file(s) changed.`,
  );
  process.exit(0);
}

console.error("[docs-sync-check] Failed: code files changed but no docs/*.md updates found.");
console.error("[docs-sync-check] Update docs/API.md or docs/SCHEMA_BIBLE.md and docs/CHANGE_NOTES.md.");
console.error("[docs-sync-check] See docs/DOC_SYNC.md for required workflow.");
process.exit(1);
