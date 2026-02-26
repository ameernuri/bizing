import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import dbPackage from "@bizing/db";
import {
  DEFAULT_SCHEMA_COVERAGE_FILE,
  getSagaCoverageReportDetail,
  listSagaCoverageReports,
} from "../services/sagas.js";

type Tag = {
  id: string;
  tagKey: string;
};

type CoverageItem = {
  id: string;
  itemType: string;
  itemRefKey: string;
  itemTitle?: string | null;
  verdict: string;
  nativeToHacky?: string | null;
  coreToExtension?: string | null;
  explanation?: string | null;
  evidence?: unknown;
  tags?: string[];
};

type CoverageDetail = {
  report: {
    id: string;
    title?: string | null;
    summary?: string | null;
    reportData?: Record<string, unknown> | null;
    createdAt?: string;
  };
  items: CoverageItem[];
  tags: Tag[];
};

const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "..",
  "mind",
  "workspaces",
  "schema coverage report (db).md",
);

const N2H_SCORE: Record<string, number> = {
  "#native": 5,
  "#mostly-native": 4,
  "#mixed-model": 3,
  "#workaround-heavy": 2,
  "#hacky": 1,
};

const C2E_SCORE: Record<string, number> = {
  "#core-centric": 5,
  "#core-first": 4,
  "#balanced-core-extension": 3,
  "#extension-heavy": 2,
  "#extension-driven": 1,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options: { out: string; reportId?: string } = { out: DEFAULT_OUTPUT_PATH };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [k, v] = arg.slice(2).split("=");
    if (k === "out" && v) options.out = path.resolve(v);
    if (k === "report-id" && v) options.reportId = v;
  }
  return options;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nTag(tags: string[], key: string, fallback?: string | null) {
  const found = tags.find((tag) => tag === key);
  return found ?? (fallback ? `#${fallback.toLowerCase()}` : null);
}

function ucSortKey(ucRef: string) {
  const match = ucRef.toUpperCase().match(/^UC-(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

async function resolveUseCaseTitles(ucRefs: string[]) {
  const refs = Array.from(new Set(ucRefs.map((value) => value.toUpperCase())));
  if (refs.length === 0) return new Map<string, string>();
  const rows = await dbPackage.db.query.sagaUseCases.findMany({
    where: (table, { inArray }) => inArray(table.ucKey, refs),
    columns: {
      ucKey: true,
      title: true,
    },
    limit: 10000,
  });
  return new Map(rows.map((row) => [row.ucKey.toUpperCase(), row.title]));
}

async function main() {
  const { out, reportId } = parseArgs();
  const reportRef =
    reportId ||
    (await listSagaCoverageReports({
      scopeType: "schema_baseline",
      limit: 1,
    }).then((rows) => rows[0]?.id));

  if (!reportRef) {
    throw new Error("No schema_baseline coverage report found in DB.");
  }

  const detail = (await getSagaCoverageReportDetail(reportRef)) as CoverageDetail | null;
  if (!detail) throw new Error(`Coverage report not found: ${reportRef}`);
  if ((detail.report as { scopeType?: string }).scopeType !== "schema_baseline") {
    throw new Error(`Report ${reportRef} is not schema_baseline.`);
  }

  const ucItems = detail.items
    .filter((row) => row.itemType === "use_case")
    .map((row) => {
      const tags = (row.tags ?? []).map((tag) => tag.toLowerCase());
      return {
        ...row,
        tags,
        verdictTag: nTag(tags, `#${String(row.verdict).toLowerCase()}`),
        n2hTag:
          tags.find((tag) => Object.prototype.hasOwnProperty.call(N2H_SCORE, tag)) ??
          (row.nativeToHacky ? `#${String(row.nativeToHacky).toLowerCase()}` : null),
        c2eTag:
          tags.find((tag) => Object.prototype.hasOwnProperty.call(C2E_SCORE, tag)) ??
          (row.coreToExtension ? `#${String(row.coreToExtension).toLowerCase()}` : null),
      };
    })
    .sort((a, b) => ucSortKey(a.itemRefKey) - ucSortKey(b.itemRefKey));

  const useCaseTitles = await resolveUseCaseTitles(ucItems.map((row) => row.itemRefKey));

  let full = 0;
  let strong = 0;
  let partial = 0;
  let gap = 0;
  const n2hCounts = new Map<string, number>([
    ["#native", 0],
    ["#mostly-native", 0],
    ["#mixed-model", 0],
    ["#workaround-heavy", 0],
    ["#hacky", 0],
  ]);
  const c2eCounts = new Map<string, number>([
    ["#core-centric", 0],
    ["#core-first", 0],
    ["#balanced-core-extension", 0],
    ["#extension-heavy", 0],
    ["#extension-driven", 0],
  ]);

  let n2hTotal = 0;
  let c2eTotal = 0;
  let n2hScored = 0;
  let c2eScored = 0;

  for (const row of ucItems) {
    const verdict = row.verdictTag ?? "#partial";
    if (verdict === "#full") full += 1;
    else if (verdict === "#strong") strong += 1;
    else if (verdict === "#gap") gap += 1;
    else partial += 1;

    if (row.n2hTag) {
      n2hCounts.set(row.n2hTag, (n2hCounts.get(row.n2hTag) ?? 0) + 1);
      const score = N2H_SCORE[row.n2hTag];
      if (score) {
        n2hTotal += score;
        n2hScored += 1;
      }
    }
    if (row.c2eTag) {
      c2eCounts.set(row.c2eTag, (c2eCounts.get(row.c2eTag) ?? 0) + 1);
      const score = C2E_SCORE[row.c2eTag];
      if (score) {
        c2eTotal += score;
        c2eScored += 1;
      }
    }
  }

  const avgN2h = n2hScored > 0 ? Number((n2hTotal / n2hScored).toFixed(2)) : 0;
  const avgC2e = c2eScored > 0 ? Number((c2eTotal / c2eScored).toFixed(2)) : 0;
  const n2hDistribution = [5, 4, 3, 2, 1]
    .map((score) => {
      const tag = Object.entries(N2H_SCORE).find(([, value]) => value === score)?.[0];
      return `${score}=${tag ? n2hCounts.get(tag) ?? 0 : 0}`;
    })
    .join(", ");
  const c2eDistribution = [5, 4, 3, 2, 1]
    .map((score) => {
      const tag = Object.entries(C2E_SCORE).find(([, value]) => value === score)?.[0];
      return `${score}=${tag ? c2eCounts.get(tag) ?? 0 : 0}`;
    })
    .join(", ");

  const reportData = asRecord(detail.report.reportData);
  const sourcePath = asString(reportData?.sourceFilePath) ?? DEFAULT_SCHEMA_COVERAGE_FILE;
  const generatedAt = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push("---");
  lines.push(`date: ${generatedAt}`);
  lines.push("tags:");
  lines.push("  - schema");
  lines.push("  - coverage");
  lines.push("  - db-generated");
  lines.push("---");
  lines.push("");
  lines.push(`# ${detail.report.title ?? "Schema Coverage Report (DB)"} `);
  lines.push("");
  lines.push(`Source report row: \`${detail.report.id}\``);
  lines.push(`Source markdown path (import origin): \`${sourcePath}\``);
  lines.push("");
  lines.push("## Legend");
  lines.push("- #full: first-class schema support exists.");
  lines.push("- #strong: schema support is strong; final behavior mainly depends on app/policy execution.");
  lines.push("- #partial: workable core exists, but one or more schema primitives are missing.");
  lines.push("- #gap: not realistically implementable without major schema additions.");
  lines.push("");
  lines.push("## Snapshot Summary (DB)");
  lines.push(`- #full: ${full}`);
  lines.push(`- #strong: ${strong}`);
  lines.push(`- #partial: ${partial}`);
  lines.push(`- #gap: ${gap}`);
  lines.push("");
  lines.push(`Total evaluated: ${ucItems.length} use cases.`);
  lines.push("");
  lines.push("### Scale Summary (Auto-scored from DB items)");
  lines.push(`- UCs scored: ${ucItems.length}`);
  lines.push(`- Avg N2H: ${avgN2h}/5`);
  lines.push(`- Avg C2E: ${avgC2e}/5`);
  lines.push(`- N2H distribution: ${n2hDistribution}`);
  lines.push(`- C2E distribution: ${c2eDistribution}`);
  lines.push("");
  lines.push("### N2H semantic totals");
  lines.push(`- #native: ${n2hCounts.get("#native") ?? 0}`);
  lines.push(`- #mostly-native: ${n2hCounts.get("#mostly-native") ?? 0}`);
  lines.push(`- #mixed-model: ${n2hCounts.get("#mixed-model") ?? 0}`);
  lines.push(`- #workaround-heavy: ${n2hCounts.get("#workaround-heavy") ?? 0}`);
  lines.push(`- #hacky: ${n2hCounts.get("#hacky") ?? 0}`);
  lines.push("");
  lines.push("### C2E semantic totals");
  lines.push(`- #core-centric: ${c2eCounts.get("#core-centric") ?? 0}`);
  lines.push(`- #core-first: ${c2eCounts.get("#core-first") ?? 0}`);
  lines.push(
    `- #balanced-core-extension: ${c2eCounts.get("#balanced-core-extension") ?? 0}`,
  );
  lines.push(`- #extension-heavy: ${c2eCounts.get("#extension-heavy") ?? 0}`);
  lines.push(`- #extension-driven: ${c2eCounts.get("#extension-driven") ?? 0}`);
  lines.push("");
  lines.push("## Coverage by Use Case (DB)");
  lines.push("");

  for (const row of ucItems) {
    const ucRef = row.itemRefKey.toUpperCase();
    const ucTitle = row.itemTitle ?? useCaseTitles.get(ucRef) ?? `Use Case ${ucRef}`;
    const sourceLink = asString(asRecord(row.evidence)?.sourceLink) ?? `booking-use-cases-v3#${ucRef}: ${ucTitle}`;
    const verdictTag = row.verdictTag ?? "#partial";
    const n2hTag = row.n2hTag ?? "#mixed-model";
    const c2eTag = row.c2eTag ?? "#balanced-core-extension";
    const explanation = row.explanation?.trim() || "No explanation provided in coverage item.";
    lines.push(
      `- [[${sourceLink}|${ucRef}]] ${verdictTag} - ${explanation} | ${n2hTag} | ${c2eTag}`,
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push(
    "- This report is generated from DB coverage rows (`scope_type = schema_baseline`) and may differ from source markdown if DB import is stale.",
  );

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${lines.join("\n")}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        reportId: detail.report.id,
        outputPath: out,
        totalUseCases: ucItems.length,
        summary: { full, strong, partial, gap },
        avg: { n2h: avgN2h, c2e: avgC2e },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[schema-coverage-report] failed:", error);
  process.exit(1);
});

