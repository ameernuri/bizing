import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { MIND_DIR } from "./mind-root.js";

const MEMORY_DIR = join(MIND_DIR, "memory");

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function getRecentDailyFiles(limit: number = 2): string[] {
  try {
    return readdirSync(MEMORY_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit);
  } catch {
    return [];
  }
}

function getSection(content: string, headings: string[]): string {
  const lines = content.split("\n");
  let capturing = false;
  const out: string[] = [];
  const wanted = new Set(headings.map((h) => h.toLowerCase()));

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      const current = headingMatch[1].trim().toLowerCase();
      capturing = wanted.has(current);
      if (!capturing && out.length > 0) break;
      continue;
    }

    if (capturing) out.push(line);
  }

  return out.join("\n").trim();
}

function extractBullets(section: string): string[] {
  return section
    .split("\n")
    .filter((l) => /^-\s+/.test(l))
    .map((l) => l.replace(/^-+\s+/, "").trim())
    .filter(Boolean);
}

function extractCheckboxes(content: string): Array<{ text: string; completed: boolean; column: string }> {
  const lines = content.split("\n");
  const tasks: Array<{ text: string; completed: boolean; column: string }> = [];
  let currentColumn = "General";

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      currentColumn = heading[1].trim();
      continue;
    }

    const task = line.match(/^- \[([ xX])\]\s*(.+)$/);
    if (!task) continue;
    tasks.push({
      completed: task[1].toLowerCase() === "x",
      text: task[2].trim(),
      column: currentColumn,
    });
  }

  return tasks;
}

export function getCompactMindState(): {
  currentFocus: string;
  topTasks: string[];
  blockers: string[];
  recentLearnings: string[];
  projectStatus: string;
} {
  const ram = readFileSafe(join(MIND_DIR, "memory", "RAM.md")) || "";
  const index = readFileSafe(join(MIND_DIR, "INDEX.md")) || "";

  const nowBullets = extractBullets(getSection(ram, ["Now"]));
  const nextTasks = extractCheckboxes(getSection(ram, ["Next"]))
    .filter((t) => !t.completed)
    .map((t) => t.text);
  const blockerBullets = extractBullets(getSection(ram, ["Blockers"]));
  const learnings = extractBullets(getSection(ram, ["Recent Learnings"]));
  const statusSection = getSection(ram, ["Status"]);

  const currentFocus =
    nowBullets[0] ||
    statusSection.split("\n").find((l) => l.trim().length > 0)?.trim() ||
    "Maintain API/schema reliability";

  const topTasks = [...nextTasks, ...nowBullets.slice(0, 2)].slice(0, 5);

  const projectStatus =
    statusSection
      .split("\n")
      .find((l) => l.trim().length > 0)
      ?.replace(/^-+\s+/, "")
      .trim() ||
    (index.includes("Current Focus") ? "Active" : "In Progress");

  return {
    currentFocus,
    topTasks: topTasks.length > 0 ? topTasks : ["Review memory/RAM and execute next item"],
    blockers: blockerBullets.length > 0 ? blockerBullets : ["None"],
    recentLearnings: learnings.length > 0 ? learnings : ["Keep memory files concise and structured"],
    projectStatus,
  };
}

export function getMindFile(path: string): { content: string | null; exists: boolean } {
  const fullPath = path.endsWith(".md") ? join(MIND_DIR, path) : join(MIND_DIR, `${path}.md`);
  const content = readFileSafe(fullPath);
  return { content, exists: content !== null };
}

export function queryMindTasks(filters?: { tag?: string; completed?: boolean }): any[] {
  const ram = readFileSafe(join(MIND_DIR, "memory", "RAM.md")) || "";
  const tasks = extractCheckboxes(ram).map((task) => ({
    text: task.text,
    completed: task.completed,
    column: task.column,
    tags: (task.text.match(/#\w+/g) || []).map((t) => t.replace("#", "")),
  }));

  return tasks.filter((task) => {
    if (filters?.completed !== undefined && task.completed !== filters.completed) return false;
    if (filters?.tag && !task.tags.includes(filters.tag)) return false;
    return true;
  });
}

export function getRecentSessions(limit: number = 5): string[] {
  const sessionsDir = join(MIND_DIR, "memory", "sessions");
  try {
    return readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        name: f,
        mtime: statSync(join(sessionsDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, limit)
      .map((f) => f.name.replace(".md", ""));
  } catch {
    // Fallback to recent daily memory logs if sessions/ is missing.
    return getRecentDailyFiles(limit).map((f) => f.replace(".md", ""));
  }
}

export function searchMind(query: string): { file: string; matches: string[] }[] {
  const results: { file: string; matches: string[] }[] = [];
  const recentDaily = getRecentDailyFiles(2).map((f) => join("memory", f));
  const filesToSearch = ["INDEX.md", "MEMORY.md", "memory/RAM.md", ...recentDaily];
  const queryLower = query.toLowerCase();

  for (const file of filesToSearch) {
    const content = readFileSafe(join(MIND_DIR, file));
    if (!content) continue;

    const matches = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.toLowerCase().includes(queryLower))
      .slice(0, 5);

    if (matches.length > 0) results.push({ file, matches });
  }

  return results;
}

export function getMindLinks(): { path: string; description: string }[] {
  return [
    { path: "INDEX.md", description: "Entry point and memory load order" },
    { path: "SOUL.md", description: "Core identity and behavior" },
    { path: "memory/RAM.md", description: "Current working memory (now/next/blockers)" },
    { path: "MEMORY.md", description: "Curated long-term context" },
    { path: "memory/", description: "Daily logs and archived history" },
    { path: "skills/Skills", description: "Operational workflows and skills" },
    { path: "workspace/", description: "Active design and implementation docs" },
  ];
}
