import { existsSync, statSync } from "fs";
import { join, resolve } from "path";

function looksLikeMindRoot(dir: string): boolean {
  try {
    const hasIndex = existsSync(join(dir, "INDEX.md"));
    const hasAgents = existsSync(join(dir, "AGENTS.md"));
    const memoryPath = join(dir, "memory");
    const hasMemoryDir = existsSync(memoryPath) && statSync(memoryPath).isDirectory();
    return hasIndex && hasAgents && hasMemoryDir;
  } catch {
    return false;
  }
}

function candidateMindDirs(): string[] {
  const cwd = process.cwd();
  const out = new Set<string>();

  // Explicit override always wins if valid.
  if (process.env.BIZING_MIND_DIR) out.add(resolve(process.env.BIZING_MIND_DIR));

  // Common project layouts.
  out.add(resolve(cwd, "..", "..", "mind"));
  out.add(resolve(cwd, "..", "..", "..", "mind"));
  out.add(resolve(cwd, "..", "..", "..", "..", "mind"));
  out.add("/Users/ameer/bizing/mind");

  // Walk upward and check for sibling `mind` dirs.
  let cursor = resolve(cwd);
  for (let i = 0; i < 8; i += 1) {
    out.add(join(cursor, "mind"));
    out.add(join(cursor, "..", "mind"));
    const parent = resolve(cursor, "..");
    if (parent === cursor) break;
    cursor = parent;
  }

  return Array.from(out);
}

function resolveMindDir(): string {
  const candidates = candidateMindDirs();
  for (const dir of candidates) {
    if (looksLikeMindRoot(dir)) return dir;
  }

  throw new Error(
    `Unable to resolve mind directory. Checked: ${candidates.join(", ")}. Set BIZING_MIND_DIR to fix.`,
  );
}

export const MIND_DIR = resolveMindDir();
