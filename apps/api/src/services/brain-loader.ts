import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { MIND_DIR } from "./mind-root.js";

interface BrainSummary {
  currentFocus: string;
  recentLearnings: string[];
  keyDecisions: string[];
  activeBlockers: string[];
  identity: {
    essence: string;
    values: string[];
  };
  recentActivity: {
    sessions: string[];
    changes: string[];
  };
}

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function getSection(content: string, heading: string): string {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
  return content.match(regex)?.[1]?.trim() || "";
}

function extractBullets(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-+\s+/, "").trim())
    .filter(Boolean);
}

function getRecentFiles(dir: string, limit: number = 3): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        name: f,
        mtime: statSync(join(dir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, limit)
      .map((f) => f.name);
  } catch {
    return [];
  }
}

export function loadBrainSummary(): BrainSummary {
  const index = readFileSafe(join(MIND_DIR, "INDEX.md")) || "";
  const ram = readFileSafe(join(MIND_DIR, "memory", "RAM.md")) || "";
  const memory = readFileSafe(join(MIND_DIR, "MEMORY.md")) || "";
  const soul = readFileSafe(join(MIND_DIR, "SOUL.md")) || "";

  const currentFocus =
    extractBullets(getSection(ram, "Now"))[0] ||
    extractBullets(getSection(index, "Current Focus (As of 2026-02-27)"))[0] ||
    "Maintain API/schema reliability";

  const blockers = extractBullets(getSection(ram, "Blockers"));
  const learnings = extractBullets(getSection(ram, "Recent Learnings"));

  const decisionSection = getSection(memory, "Key Operating Decisions");
  const decisions = extractBullets(decisionSection).slice(0, 8);

  const identityEssence =
    soul
      .split("\n")
      .find((line) => line.toLowerCase().includes("i am the platform"))?.trim() ||
    "Bizing is a business platform assistant focused on reliable execution.";

  const sessionsDir = join(MIND_DIR, "memory", "sessions");
  const recentSessions = getRecentFiles(sessionsDir, 3);

  return {
    currentFocus,
    recentLearnings: learnings.length > 0 ? learnings : ["Keep memory compact and deterministic"],
    keyDecisions: decisions.length > 0 ? decisions : ["Use canonical memory files: INDEX, RAM, MEMORY"],
    activeBlockers: blockers.length > 0 ? blockers : ["None"],
    identity: {
      essence: identityEssence,
      values: ["clarity", "reliability", "evolution-through-feedback"],
    },
    recentActivity: {
      sessions: recentSessions,
      changes: [],
    },
  };
}

export function formatBrainForPrompt(summary: BrainSummary): string {
  return `
## Current Brain State

Focus: ${summary.currentFocus}
Identity: ${summary.identity.essence}
Values: ${summary.identity.values.join(", ")}

Recent Learnings:
${summary.recentLearnings.map((l) => `- ${l}`).join("\n")}

Active Blockers:
${summary.activeBlockers.map((b) => `- ${b}`).join("\n")}

Recent Sessions: ${summary.recentActivity.sessions.join(", ") || "None recorded"}
`;
}

let cachedSummary: BrainSummary | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000;

export function getCachedBrainSummary(): BrainSummary {
  const now = Date.now();
  if (!cachedSummary || now - cacheTime > CACHE_TTL) {
    cachedSummary = loadBrainSummary();
    cacheTime = now;
  }
  return cachedSummary;
}
