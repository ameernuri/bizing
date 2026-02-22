import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type Finding = {
  level: "error" | "warn";
  rule: string;
  file: string;
  detail: string;
};

type DirectIdReference = {
  columnName: string;
  parentTableConst: string;
};

const schemaRoot = join(process.cwd(), "src", "schema");

/**
 * Tables intentionally not tenant-scoped by `biz_id`.
 *
 * Why allowlist:
 * - root identity/auth tables can be global by design,
 * - biz table itself is the tenant root and cannot reference itself as tenant.
 * - extension catalog definitions are global templates reused by many bizes.
 */
const nonTenantScopedTables = new Set([
  "bizes",
  "users",
  "sessions",
  "accounts",
  "verifications",
  "members",
  "invitations",
  // User-owned/global social graph backbone (can span multiple bizes).
  "graphIdentities",
  "graphIdentityPolicies",
  "graphRelationships",
  "graphRelationshipEvents",
  "graphAudienceSegments",
  "graphAudienceSegmentMembers",
  "graphFeedItems",
  "graphFeedItemLinks",
  "graphFeedItemDeliveries",
  "graphIdentityNotificationEndpoints",
  "graphSubjectSubscriptions",
  "graphFeedItemAudienceRules",
  // User-owned external calendar sync and cross-biz grant domain.
  "calendarSyncConnections",
  "externalCalendars",
  "calendarAccessGrants",
  "calendarAccessGrantSources",
  "externalCalendarEvents",
  "extensionDefinitions",
  "extensionPermissionDefinitions",
  // Credential exchange: explicitly scoped via owner/grantee dimensions.
  "credentialTypeDefinitions",
  "userCredentialProfiles",
  "userCredentialRecords",
  "userCredentialDocuments",
  "userCredentialFacts",
  "userCredentialVerifications",
  "bizCredentialShareGrants",
  "bizCredentialShareGrantSelectors",
  "credentialDisclosureEvents",
]);

/**
 * Tables intentionally scoped by `owner_user_id` instead of `biz_id`.
 *
 * These are portable user-owned records that can be shared with many bizes.
 */
const ownerUserScopedTables = new Set([
  "userCredentialProfiles",
  "userCredentialRecords",
  "userCredentialDocuments",
  "userCredentialFacts",
  "userCredentialVerifications",
  "credentialDisclosureEvents",
  "bizCredentialShareGrants",
  "bizCredentialShareGrantSelectors",
]);

/**
 * Tables intentionally scoped by grantee-biz contract pointers.
 *
 * These represent cross-biz sharing contracts rather than one-tenant-owned rows.
 */
const granteeBizScopedTables = new Set([
  "bizCredentialShareGrants",
  "bizCredentialShareGrantSelectors",
  "credentialDisclosureEvents",
]);

/**
 * Global platform dictionaries/catalogs that are deployment-wide by design.
 */
const platformScopedTables = new Set([
  "credentialTypeDefinitions",
]);

/**
 * Tables allowed to keep provider/external status values as raw text/varchar.
 *
 * Why allowlist:
 * - Better Auth and provider mirror tables often need exact third-party status
 *   values that do not map cleanly to one internal enum lifecycle.
 * - We still emit warnings for visibility, but do not fail guard on these.
 */
const statusPrimitiveAllowlist = new Set([
  "invitations",
]);

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function extractPgTableBlocks(
  source: string,
): Array<{ name: string; block: string; start: number }> {
  const matches = [...source.matchAll(/export const\s+(\w+)\s*=\s*pgTable\s*\(/g)];
  const blocks: Array<{ name: string; block: string; start: number }> = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index ?? 0;
    const end = next?.index ?? source.length;
    blocks.push({
      name: current[1],
      block: source.slice(start, end),
      start,
    });
  }
  return blocks;
}

function extractDirectIdReferences(tableBlock: string): DirectIdReference[] {
  /**
   * Matches fields like:
   *   fooId: idRef("foo_id").references(() => foos.id)
   * including multiline chains.
   */
  const pattern =
    /(\w+)\s*:\s*idRef\(\s*["'][^"']+["']\s*\)([\s\S]*?)\.references\(\s*\(\)\s*=>\s*(\w+)\.id\s*\)/g;
  const refs: DirectIdReference[] = [];
  for (const match of tableBlock.matchAll(pattern)) {
    const [, columnName, chainChunk, parentTableConst] = match;
    /**
     * Ignore matches that accidentally cross into another field definition.
     * We only want chain calls attached to this same column.
     */
    if (chainChunk.includes("\n    ") && chainChunk.includes(":")) continue;
    refs.push({ columnName, parentTableConst });
  }
  return refs;
}

function hasTenantSafeCompositeFk(
  tableBlock: string,
  childColumnName: string,
  parentTableConst: string,
): boolean {
  /**
   * Detect one nearby `columns: [...]` + `foreignColumns: [...]` pair where:
   * - child columns include one *BizId key and table.<childColumnName>
   * - parent columns include <parent>.bizId and <parent>.id
   *
   * Extra discriminator columns are allowed on both sides.
   */
  const compositePattern = new RegExp(
    String.raw`columns:\s*\[(?=[^\]]*table\.\w*bizId)(?=[^\]]*table\.${childColumnName})[^\]]*\][\s\S]{0,900}?foreignColumns:\s*\[(?=[^\]]*${parentTableConst}\.bizId)(?=[^\]]*${parentTableConst}\.id)[^\]]*\]`,
  );
  return compositePattern.test(tableBlock);
}

function scanFile(file: string): Finding[] {
  const findings: Finding[] = [];
  const source = readFileSync(file, "utf8");
  const rel = relative(process.cwd(), file);

  if (/@codex|TODO|FIXME/.test(source)) {
    findings.push({
      level: "error",
      rule: "no-leftover-notes",
      file: rel,
      detail: "Found @codex/TODO/FIXME marker. Resolve before merging schema changes.",
    });
  }

  for (const table of extractPgTableBlocks(source)) {
    const tableHasBizId = /\bbizId\s*:\s*idRef\(\s*["']biz_id["']\s*\)/.test(
      table.block,
    );
    /**
     * Status field detectors:
     * - accept optional second+ args in column builders
     *   (e.g. varchar("status", { length: 40 }))
     * - avoid false negatives from previous strict "single-arg only" regex.
     */
    const hasStatusEnum = /\bstatus\s*:\s*\w+Enum\(\s*["']status["'][^)]*\)/.test(
      table.block,
    );
    const hasStatusColumn = /\bstatus\s*:\s*[a-zA-Z_][a-zA-Z0-9_]*\(\s*["']status["'][^)]*\)/.test(
      table.block,
    );
    const hasNonEnumStatus =
      /\bstatus\s*:\s*(varchar|text|integer|bigint|smallint|boolean|jsonb)\(\s*["']status["'][^)]*\)/.test(
        table.block,
      );
    /**
     * Configurable status pattern:
     * a deterministic canonical `status` plus optional per-biz dictionary
     * indirection via `status_config_value_id`.
     */
    const hasStatusConfigValuePointer =
      /\bstatusConfigValueId\s*:\s*idRef\(\s*["']status_config_value_id["']\s*\)/.test(
        table.block,
      );
    /**
     * If status is primitive but backed by explicit CHECK constraints, lifecycle
     * semantics are at least DB-constrained even without enum helper usage.
     */
    const hasStatusCheckConstraint =
      /"status"\s+IN\s*\(/.test(table.block) ||
      /"status"\s+LIKE\s+['"]custom_/.test(table.block);
    const hasIsActive = /\bisActive\s*:\s*boolean\(\s*["']is_active["']\s*\)/.test(
      table.block,
    );
    if (hasStatusColumn && hasIsActive) {
      findings.push({
        level: "error",
        rule: "lifecycle-single-source-of-truth",
        file: rel,
        detail: `Table "${table.name}" defines both status and is_active. Keep one lifecycle control.`,
      });
    }

    const isStatusPrimitiveAllowed =
      statusPrimitiveAllowlist.has(table.name) ||
      rel.startsWith("src/schema/stripe.ts") ||
      rel.includes("src/schema/auth/");

    if (
      hasStatusColumn &&
      !hasStatusEnum &&
      !isStatusPrimitiveAllowed &&
      !hasStatusConfigValuePointer &&
      !hasStatusCheckConstraint
    ) {
      findings.push({
        level: "warn",
        rule: "status-enum-preferred",
        file: rel,
        detail: `Table "${table.name}" defines status without enum helper. Prefer enum-backed status for deterministic lifecycle semantics.`,
      });
    }

    if (hasNonEnumStatus) {
      const isConstrainedPrimitiveStatus =
        hasStatusCheckConstraint || hasStatusConfigValuePointer;

      if (isStatusPrimitiveAllowed) {
        findings.push({
          level: "warn",
          rule: "status-primitive-allowlisted",
          file: rel,
          detail: `Table "${table.name}" stores status as primitive by allowlist (provider/auth compatibility). Consider enum if semantics become internal lifecycle.`,
        });
        continue;
      }
      if (isConstrainedPrimitiveStatus) {
        // Allowed pattern:
        // - explicit CHECK constraint or status_config indirection means runtime
        //   semantics are constrained even without enum helper syntax.
        // We keep guard output high-signal by not emitting noisy warnings here.
        continue;
      }
      findings.push({
        level: "error",
        rule: "status-must-be-enum",
        file: rel,
        detail: `Table "${table.name}" defines status with primitive column type. Use a dedicated enum for lifecycle integrity.`,
      });
    }

    if (!nonTenantScopedTables.has(table.name) && !tableHasBizId) {
      findings.push({
        level: "warn",
        rule: "tenant-boundary",
        file: rel,
        detail: `Table "${table.name}" has no explicit biz_id column. Verify this is intentional.`,
      });
    }

    /**
     * Tenant-safe FK policy:
     * for tenant-scoped tables, direct FK references to tenant-scoped parents
     * should use composite (biz_id, fk_id) -> (biz_id, id).
     */
    if (tableHasBizId && !nonTenantScopedTables.has(table.name)) {
      for (const directRef of extractDirectIdReferences(table.block)) {
        const parentIsGlobal =
          nonTenantScopedTables.has(directRef.parentTableConst) ||
          platformScopedTables.has(directRef.parentTableConst);
        if (parentIsGlobal) continue;
        if (directRef.columnName === "bizId") continue;

        if (
          hasTenantSafeCompositeFk(
            table.block,
            directRef.columnName,
            directRef.parentTableConst,
          )
        ) {
          continue;
        }

        findings.push({
          level: "warn",
          rule: "tenant-safe-composite-fk-missing",
          file: rel,
          detail: `Table "${table.name}" column "${directRef.columnName}" references "${directRef.parentTableConst}.id" without matching composite (biz_id, ${directRef.columnName}) -> (${directRef.parentTableConst}.biz_id, id) FK.`,
        });
      }
    }

    if (
      ownerUserScopedTables.has(table.name) &&
      !/\bownerUserId\s*:\s*idRef\(\s*["']owner_user_id["']\s*\)/.test(table.block)
    ) {
      findings.push({
        level: "error",
        rule: "owner-user-scope-required",
        file: rel,
        detail: `Table "${table.name}" is owner-user scoped and must define owner_user_id.`,
      });
    }

    if (
      granteeBizScopedTables.has(table.name) &&
      !/\bgranteeBizId\s*:\s*idRef\(\s*["']grantee_biz_id["']\s*\)/.test(table.block)
    ) {
      findings.push({
        level: "error",
        rule: "grantee-biz-scope-required",
        file: rel,
        detail: `Table "${table.name}" is grantee-biz scoped and must define grantee_biz_id.`,
      });
    }

    if (
      platformScopedTables.has(table.name) &&
      /\bbizId\s*:\s*idRef\(\s*["']biz_id["']\s*\)/.test(table.block)
    ) {
      findings.push({
        level: "warn",
        rule: "platform-scope-biz-id-present",
        file: rel,
        detail: `Table "${table.name}" is platform scoped; verify biz_id is intentionally present.`,
      });
    }

  }

  return findings;
}

function main() {
  const files = walkTsFiles(schemaRoot);
  const findings = files.flatMap(scanFile);
  const errors = findings.filter((f) => f.level === "error");
  const warns = findings.filter((f) => f.level === "warn");

  for (const finding of findings) {
    const prefix = finding.level === "error" ? "ERROR" : "WARN ";
    console.log(`${prefix} [${finding.rule}] ${finding.file} -> ${finding.detail}`);
  }

  console.log(
    `schema-guard: ${errors.length} error(s), ${warns.length} warning(s) across ${files.length} file(s).`,
  );

  if (errors.length > 0) process.exit(1);
}

main();
