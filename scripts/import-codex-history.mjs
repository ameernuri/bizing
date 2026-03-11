#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DB_PATH = join(homedir(), ".codex", "state_5.sqlite");
const OUTPUT_PATH = "/Users/ameer/bizing/mind/memory/codex-project-history.md";
const WORKSPACE_PREFIXES = ["/Users/ameer/bizing", "/Users/ameer/projects/bizing"];
const FIELD_SEPARATOR = "\u001f";

function sqlEscape(value) {
  return value.replaceAll("'", "''");
}

function runSql(sql) {
  const raw = execFileSync("sqlite3", ["-separator", FIELD_SEPARATOR, DB_PATH, sql], {
    encoding: "utf8",
  }).trim();

  if (!raw) {
    return [];
  }

  return raw.split("\n").map((line) => line.split(FIELD_SEPARATOR));
}

function normalizeCell(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().replaceAll("|", "\\|");
}

const whereClause = WORKSPACE_PREFIXES.map(
  (prefix) => `(cwd = '${sqlEscape(prefix)}' OR cwd LIKE '${sqlEscape(prefix)}/%')`,
).join(" OR ");

const [summaryRow = ["0", "", ""]] = runSql(`
  SELECT
    COUNT(*),
    COALESCE(datetime(MIN(created_at), 'unixepoch'), ''),
    COALESCE(datetime(MAX(updated_at), 'unixepoch'), '')
  FROM threads
  WHERE ${whereClause};
`);

const workspaceRows = runSql(`
  SELECT
    cwd,
    COUNT(*),
    datetime(MIN(created_at), 'unixepoch'),
    datetime(MAX(updated_at), 'unixepoch')
  FROM threads
  WHERE ${whereClause}
  GROUP BY cwd
  ORDER BY MIN(created_at);
`);

const threadRows = runSql(`
  SELECT
    id,
    cwd,
    COALESCE(git_branch, ''),
    datetime(created_at, 'unixepoch'),
    datetime(updated_at, 'unixepoch'),
    REPLACE(REPLACE(COALESCE(title, ''), char(10), ' '), char(13), ' '),
    REPLACE(REPLACE(COALESCE(first_user_message, ''), char(10), ' '), char(13), ' ')
  FROM threads
  WHERE ${whereClause}
  ORDER BY created_at;
`);

const [threadCount, firstSeenUtc, lastSeenUtc] = summaryRow;
const generatedAtUtc = new Date().toISOString();

const lines = [
  "---",
  "date: 2026-03-10",
  "tags:",
  "  - codex",
  "  - history-import",
  "  - bizing",
  "  - generated",
  `source: ${DB_PATH}`,
  `generated_at_utc: ${generatedAtUtc}`,
  `thread_count: ${threadCount}`,
  `coverage_window_utc: ${firstSeenUtc} to ${lastSeenUtc}`,
  "---",
  "",
  "# Codex Project History",
  "",
  "## Import Scope",
  `- Import source: \`${DB_PATH}\``,
  `- Included workspace prefixes: ${WORKSPACE_PREFIXES.map((prefix) => `\`${prefix}\``).join(", ")}`,
  `- Thread coverage window: ${firstSeenUtc} to ${lastSeenUtc} UTC`,
  `- Imported thread count: ${threadCount}`,
  "",
  "## Workspace Summary",
  "",
  "| Workspace | Threads | First seen (UTC) | Last seen (UTC) |",
  "| --- | ---: | --- | --- |",
  ...workspaceRows.map(
    ([cwd, count, first, last]) =>
      `| \`${normalizeCell(cwd)}\` | ${count} | ${first} | ${last} |`,
  ),
  "",
  "## Thread Inventory",
  "",
  "| Created (UTC) | Updated (UTC) | Workspace | Branch | Thread ID | Title | First user message |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...threadRows.map(
    ([id, cwd, branch, createdUtc, updatedUtc, title, firstUserMessage]) =>
      `| ${createdUtc} | ${updatedUtc} | \`${normalizeCell(cwd)}\` | ${
        branch ? `\`${normalizeCell(branch)}\`` : ""
      } | \`${normalizeCell(id)}\` | ${normalizeCell(title)} | ${normalizeCell(firstUserMessage)} |`,
  ),
  "",
  "## Notes",
  "",
  "- This file is generated from local Codex thread metadata and should be regenerated instead of hand-edited.",
  "- Older narrative summaries remain useful context but are secondary to this source-backed thread inventory:",
  "- `/Users/ameer/bizing/mind/memory/codex-collaboration-history.md`",
  "- `/Users/ameer/bizing/mind/memory/schema-evolution-history.md`",
  "",
];

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");

console.log(`[import-codex-history] Wrote ${threadCount} thread(s) to ${OUTPUT_PATH}`);
