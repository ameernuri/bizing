#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ROUTES_DIR = path.join(ROOT, "apps", "api", "src", "routes");
const SCHEMA_DIR = path.join(ROOT, "packages", "db", "src", "schema");
const OUT_DIR = path.join(ROOT, "docs", "domains");
const MANIFEST_PATH = path.join(ROOT, "apps", "api", "src", "routes", "domain-manifest.json");

const CHECK_MODE = process.argv.includes("--check");

function toTitle(domainKey) {
  return domainKey
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function toRepoPath(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function extractTopBlockComment(content) {
  const match = content.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  if (!match) return null;
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd())
    .join("\n")
    .trim();
}

function extractRoutes(content) {
  const routeRegex =
    /\.\s*(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gim;
  const routes = [];
  for (const match of content.matchAll(routeRegex)) {
    const pathValue = String(match[2] || "");
    if (!pathValue.startsWith("/")) continue;
    routes.push({
      method: String(match[1] || "").toUpperCase(),
      path: pathValue,
    });
  }
  return routes;
}

function extractTables(content) {
  const tableRegex = /pgTable\s*\(\s*["'`]([^"'`]+)["'`]/gim;
  const tables = [];
  for (const match of content.matchAll(tableRegex)) {
    tables.push(String(match[1] || ""));
  }
  return tables;
}

function normalizeApiPath(rawPath) {
  const base = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  if (base.startsWith("/api/")) return base;
  return `/api/v1${base}`;
}

function joinMountedPath(prefix, routePath) {
  const normalizedPrefix = prefix === "/" ? "" : prefix.replace(/\/+$/, "");
  const normalizedRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;
  if (normalizedRoute === "/") return normalizedPrefix || "/";
  const combined = `${normalizedPrefix}${normalizedRoute}`;
  return combined || "/";
}

function buildDoc(input) {
  const {
    domainKey,
    mountPath,
    routePath,
    schemaPath,
    authClass,
    routeDoc,
    schemaDoc,
  } = input;
  const title = toTitle(domainKey);

  const lines = [];
  lines.push("---");
  lines.push("tags:");
  lines.push("  - bizing");
  lines.push("  - domain");
  lines.push("  - generated");
  lines.push(`  - ${domainKey}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${title} Domain`);
  lines.push("");
  lines.push(
    "This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.",
  );
  lines.push("");

  lines.push("## Source");
  lines.push("");
  lines.push(`- Route file: \`${routePath}\``);
  lines.push(`- Schema file: ${schemaPath ? `\`${schemaPath}\`` : "_No canonical schema module mapped._"}`);
  lines.push(`- Mount path: \`${mountPath}\``);
  lines.push(`- Auth class (manifest): \`${authClass}\``);
  lines.push("");

  lines.push("## Route Intent (top JSDoc)");
  lines.push("");
  lines.push(routeDoc?.comment ? routeDoc.comment : "_No top JSDoc comment found._");
  lines.push("");

  lines.push("## Schema Intent (top JSDoc)");
  lines.push("");
  lines.push(schemaDoc?.comment ? schemaDoc.comment : "_No top JSDoc comment found._");
  lines.push("");

  lines.push("## API Surface");
  lines.push("");
  if (routeDoc?.routes?.length) {
    for (const route of routeDoc.routes) {
      const mountedPath = route.path.startsWith("/api/")
        ? route.path
        : normalizeApiPath(joinMountedPath(mountPath, route.path));
      lines.push(`- \`${route.method}\` \`${mountedPath}\``);
    }
  } else {
    lines.push("_No route declarations found._");
  }
  lines.push("");

  lines.push("## Tables");
  lines.push("");
  if (schemaDoc?.tables?.length) {
    for (const table of schemaDoc.tables) {
      lines.push(`- \`${table}\``);
    }
  } else {
    lines.push("_No table declarations found in mapped schema module._");
  }
  lines.push("");

  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].",
  );
  lines.push("- Run `bun run docs:generate:domains` after changing route/schema behavior.");
  lines.push("");

  return lines.join("\n");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadManifest() {
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    throw new Error("Invalid domain manifest format.");
  }
  return parsed;
}

function validateManifestEntries(entries) {
  const keyToDocs = new Map();
  const routeToKey = new Map();
  const docsToKey = new Map();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Manifest entry must be an object.");
    }
    const key = String(entry.key || "").trim();
    const routeFile = String(entry.routeFile || "").trim();
    const docsFile = String(entry.docsFile || "").trim();
    const mountPath = String(entry.mountPath || "").trim();
    const authClass = String(entry.authClass || "").trim();
    const schemaModule = String(entry.schemaModule || "").trim();

    if (!key) throw new Error("Manifest entry has empty key.");
    if (!routeFile) throw new Error(`Manifest entry ${key} is missing routeFile.`);
    if (!docsFile) throw new Error(`Manifest entry ${key} is missing docsFile.`);
    if (!schemaModule) {
      throw new Error(`Manifest entry ${key} is missing schemaModule.`);
    }
    if (!mountPath.startsWith("/")) {
      throw new Error(`Manifest entry ${key} has invalid mountPath '${mountPath}'.`);
    }
    if (!["public", "session_only", "machine_allowed", "internal_only"].includes(authClass)) {
      throw new Error(`Manifest entry ${key} has invalid authClass '${authClass}'.`);
    }

    if (keyToDocs.has(key)) {
      throw new Error(`Duplicate manifest key '${key}' for docs '${docsFile}'.`);
    }
    if (routeToKey.has(routeFile)) {
      throw new Error(`Route file '${routeFile}' is assigned to multiple keys (${routeToKey.get(routeFile)}, ${key}).`);
    }
    if (docsToKey.has(docsFile)) {
      throw new Error(`Docs file '${docsFile}' is assigned to multiple keys (${docsToKey.get(docsFile)}, ${key}).`);
    }
    keyToDocs.set(key, docsFile);
    routeToKey.set(routeFile, key);
    docsToKey.set(docsFile, key);
  }
}

async function main() {
  const manifest = await loadManifest();
  validateManifestEntries(manifest.entries);
  await fs.mkdir(OUT_DIR, { recursive: true });

  let changed = 0;
  const processed = [];

  for (const entry of manifest.entries) {
    if (!entry || typeof entry !== "object") continue;

    const domainKey = String(entry.key || "").trim();
    const routeFile = String(entry.routeFile || "").trim();
    const mountPath = String(entry.mountPath || "/").trim() || "/";
    const docsFile = String(entry.docsFile || "").trim();
    const schemaModule = String(entry.schemaModule || "").trim();
    const authClass = String(entry.authClass || "machine_allowed");

    if (!domainKey || !routeFile || !docsFile) continue;
    if (!schemaModule) {
      throw new Error(`Manifest schema module is required (key=${domainKey})`);
    }

    const routePath = path.join(ROUTES_DIR, routeFile);
    if (!(await exists(routePath))) {
      throw new Error(`Manifest route file is missing: ${routeFile}`);
    }

    const schemaPath = path.join(SCHEMA_DIR, `${schemaModule}.ts`);
    const schemaExists = await exists(schemaPath);
    if (!schemaExists) {
      throw new Error(`Manifest schema module is missing: ${schemaModule}.ts (key=${domainKey})`);
    }

    const routeContent = await fs.readFile(routePath, "utf8");
    const schemaContent = schemaExists ? await fs.readFile(schemaPath, "utf8") : "";

    const output = buildDoc({
      domainKey,
      mountPath,
      routePath: toRepoPath(routePath),
      schemaPath: toRepoPath(schemaPath),
      authClass,
      routeDoc: {
        comment: extractTopBlockComment(routeContent),
        routes: extractRoutes(routeContent),
      },
      schemaDoc: {
        comment: extractTopBlockComment(schemaContent),
        tables: extractTables(schemaContent),
      },
    });

    const outPath = path.join(ROOT, docsFile);
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    const current = (await exists(outPath)) ? await fs.readFile(outPath, "utf8") : null;
    if (current !== output) {
      changed += 1;
      if (!CHECK_MODE) {
        await fs.writeFile(outPath, output, "utf8");
      }
    }
    processed.push(domainKey);
  }

  if (CHECK_MODE && changed > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          changed,
          message:
            "Domain docs are stale. Run `bun run docs:generate:domains` and commit generated files.",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  if (!CHECK_MODE) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          generated: processed.length,
          changed,
          outDir: OUT_DIR,
          manifest: MANIFEST_PATH,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(JSON.stringify({ ok: true, checked: processed.length }, null, 2));
  }
}

main().catch((error) => {
  console.error("[generate-domain-docs] failed");
  console.error(error);
  process.exit(1);
});
