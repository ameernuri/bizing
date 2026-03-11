#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const CODE_ROOT = path.resolve(import.meta.dirname, "..");
const WORKSPACE_ROOT = path.resolve(CODE_ROOT, "..");
const MIND_ROOT = path.join(WORKSPACE_ROOT, "mind");
const EVENTS_DIR = path.join(MIND_ROOT, "events");
const EVENTS_INDEX_PATH = path.join(EVENTS_DIR, "index.md");
const ATLAS_PATH = path.join(MIND_ROOT, "ATLAS.md");

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  return match ? match[1] : "";
}

function extractYamlValue(frontmatter, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = frontmatter.match(new RegExp(`^${escapedKey}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function unique(values) {
  return Array.from(new Set(values));
}

function extractEventLinks(markdown) {
  const links = [];
  const regex = /\[\[events\/(EV-\d{4}-[^\]]+)\]\]/g;
  for (const match of markdown.matchAll(regex)) {
    links.push(match[1]);
  }
  return links;
}

function extractRecentTurnsSection(atlasContent) {
  const sectionMatch = atlasContent.match(/### Recent Turns\n([\s\S]*?)(?:\n## |\n### |\n$)/);
  return sectionMatch ? sectionMatch[1] : "";
}

async function main() {
  const errors = [];

  const eventFiles = (await fs.readdir(EVENTS_DIR))
    .filter((name) => /^EV-\d{4}-.+\.md$/.test(name))
    .sort();

  const eventIds = [];
  const eventSlugsFromFiles = [];
  for (const fileName of eventFiles) {
    const filePath = path.join(EVENTS_DIR, fileName);
    const content = await fs.readFile(filePath, "utf8");
    const frontmatter = extractFrontmatter(content);
    const idRaw = extractYamlValue(frontmatter, "id");
    const fileSlug = fileName.replace(/\.md$/, "");
    eventSlugsFromFiles.push(fileSlug);

    if (!idRaw || !/^EV-\d{4}(?:-[a-z0-9-]+)?$/.test(idRaw)) {
      errors.push(`Invalid or missing id in ${fileName}`);
      continue;
    }
    const canonicalIdMatch = idRaw.match(/^EV-\d{4}/);
    const canonicalId = canonicalIdMatch ? canonicalIdMatch[0] : null;
    if (!canonicalId) {
      errors.push(`Invalid canonical id in ${fileName}: ${idRaw}`);
      continue;
    }

    const fileMatchesId = fileSlug === idRaw || fileSlug.startsWith(`${canonicalId}-`);
    if (!fileMatchesId) {
      errors.push(`Event filename/id mismatch: ${fileName} declares ${idRaw}`);
    }

    eventIds.push(canonicalId);
  }

  if (unique(eventIds).length !== eventIds.length) {
    const duplicates = eventIds.filter((id, idx) => eventIds.indexOf(id) !== idx);
    errors.push(`Duplicate event ids detected: ${unique(duplicates).join(", ")}`);
  }

  const eventsIndexContent = await fs.readFile(EVENTS_INDEX_PATH, "utf8");
  const eventLinks = extractEventLinks(eventsIndexContent);
  const eventLinkSet = new Set(eventLinks);
  const eventFileSet = new Set(eventSlugsFromFiles);

  for (const slug of eventSlugsFromFiles) {
    if (!eventLinkSet.has(slug)) {
      errors.push(`events/index.md is missing event link for ${slug}`);
    }
  }
  for (const slug of eventLinks) {
    if (!eventFileSet.has(slug)) {
      errors.push(`events/index.md references missing event file ${slug}`);
    }
  }

  const atlasContent = await fs.readFile(ATLAS_PATH, "utf8");
  const recentTurns = extractRecentTurnsSection(atlasContent);
  if (!recentTurns) {
    errors.push("ATLAS.md is missing a '### Recent Turns' section.");
  } else {
    const requiredLinks = ["[[events/index]]", "[[decisions/index]]", "[[interactions/index]]"];
    for (const requiredLink of requiredLinks) {
      if (!recentTurns.includes(requiredLink)) {
        errors.push(`ATLAS.md Recent Turns must include ${requiredLink}`);
      }
    }

    const hardcodedEventRefs = recentTurns.match(/\[\[events\/EV-\d{4}-[^\]]+\]\]/g) ?? [];
    if (hardcodedEventRefs.length > 0) {
      errors.push("ATLAS.md Recent Turns should not hardcode EV links; use ledger index links instead.");
    }
  }

  if (errors.length > 0) {
    console.error("[check-atlas-sync] failed");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checkedEventFiles: eventFiles.length,
        checkedEventLinks: eventLinks.length,
        checkedAtlas: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[check-atlas-sync] failed");
  console.error(error);
  process.exit(1);
});
