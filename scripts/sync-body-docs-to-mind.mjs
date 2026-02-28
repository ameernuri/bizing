#!/usr/bin/env node

/**
 * sync-body-docs-to-mind
 *
 * Mirrors canonical code docs from `/Users/ameer/bizing/code/docs` into
 * `/Users/ameer/bizing/mind/workspace/body` so mind retrieval has direct,
 * up-to-date content in Obsidian-native markdown.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_DIR = "/Users/ameer/bizing/code/docs";
const TARGET_DIR = "/Users/ameer/bizing/mind/workspace/body";
const SYNC_INFO_FILE = join(TARGET_DIR, "_SYNC_INFO.md");

mkdirSync(TARGET_DIR, { recursive: true });

const files = readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".md"));

for (const fileName of files) {
  const sourcePath = join(SOURCE_DIR, fileName);
  const targetPath = join(TARGET_DIR, fileName);
  const content = readFileSync(sourcePath, "utf8");
  writeFileSync(targetPath, content, "utf8");
}

const now = new Date().toISOString();
writeFileSync(
  SYNC_INFO_FILE,
  [
    "# Body Docs Sync Info",
    "",
    `Last sync: ${now}`,
    "",
    "This directory is mirrored from:",
    "- `/Users/ameer/bizing/code/docs`",
    "",
    "Do not manually edit mirrored files here.",
    "Edit canonical files in `/Users/ameer/bizing/code/docs` and rerun:",
    "- `bun run docs:sync:mind`",
    "",
    "Related:",
    "- [[INDEX]]",
    "- [[DOC_SYNC]]",
  ].join("\n"),
  "utf8",
);

console.log(`[sync-body-docs-to-mind] Synced ${files.length} file(s) to ${TARGET_DIR}`);
