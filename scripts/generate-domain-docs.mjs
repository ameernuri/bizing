#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ROUTES_DIR = path.join(ROOT, "apps", "api", "src", "routes");
const SCHEMA_DIR = path.join(ROOT, "packages", "db", "src", "schema");
const OUT_DIR = path.join(ROOT, "docs", "domains");

const CHECK_MODE = process.argv.includes("--check");

function toDomainKey(fileName) {
  return fileName.replace(/\.ts$/, "").replace(/^_/, "");
}

function toTitle(domainKey) {
  return domainKey
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
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
    routes.push({
      method: String(match[1] || "").toUpperCase(),
      path: String(match[2] || ""),
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

function buildDoc(domainKey, routeDoc, schemaDoc) {
  const title = toTitle(domainKey);
  const routePath = `/Users/ameer/bizing/code/apps/api/src/routes/${domainKey}.ts`;
  const schemaPath = `/Users/ameer/bizing/code/packages/db/src/schema/${domainKey}.ts`;

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
    "This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.",
  );
  lines.push("");

  lines.push("## Source");
  lines.push("");
  lines.push(`- Route file: \`${routePath}\``);
  lines.push(`- Schema file: \`${schemaPath}\``);
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
      lines.push(`- \`${route.method}\` \`${route.path}\``);
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
    lines.push("_No table declarations found in schema file._");
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

async function main() {
  const routeFiles = (await fs.readdir(ROUTES_DIR)).filter((name) => name.endsWith(".ts"));
  await fs.mkdir(OUT_DIR, { recursive: true });

  let changed = 0;
  const processed = [];

  for (const routeFile of routeFiles) {
    const domainKey = toDomainKey(routeFile);
    if (domainKey.startsWith("_")) continue;
    const routePath = path.join(ROUTES_DIR, routeFile);
    const schemaPath = path.join(SCHEMA_DIR, `${domainKey}.ts`);
    if (!(await exists(schemaPath))) continue;

    const routeContent = await fs.readFile(routePath, "utf8");
    const schemaContent = await fs.readFile(schemaPath, "utf8");

    const output = buildDoc(
      domainKey,
      {
        comment: extractTopBlockComment(routeContent),
        routes: extractRoutes(routeContent),
      },
      {
        comment: extractTopBlockComment(schemaContent),
        tables: extractTables(schemaContent),
      },
    );

    const outPath = path.join(OUT_DIR, `${domainKey}.md`);
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

