/**
 * Customer Operations routes.
 *
 * ELI5:
 * This route family is the "customer operating system" API:
 * - CRM activities and tasks
 * - support cases and case events
 * - lifecycle marketing journeys
 * - customer autopilot playbooks
 *
 * Design intent:
 * - keep sales/support/marketing cohesive around one customer profile anchor
 * - keep writes on canonical action runtime rails via the CRUD route bridge
 * - keep reads simple for humans and agents
 */

import { Hono } from "hono";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import dbPackage from "@bizing/db";
import { requireAclPermission, requireAuth, requireBizAccess } from "../middleware/auth.js";
import { executeCrudRouteAction } from "../services/action-route-bridge.js";
import { fail, ok, parsePositiveInt } from "./_api.js";
import { sanitizePlainText, sanitizeUnknown } from "../lib/sanitize.js";

const {
  db,
  customerProfiles,
  customerIdentityHandles,
  customerIdentityLinks,
  customerProfileCrmLinks,
  customerProfileMerges,
  customerTimelineEvents,
  crmActivities,
  crmTasks,
  supportCases,
  supportCaseEvents,
  supportCaseParticipants,
  supportCaseLinks,
  customerJourneys,
  customerJourneySteps,
  customerJourneyEnrollments,
  customerJourneyEvents,
  customerPlaybooks,
  customerPlaybookBindings,
  customerPlaybookRuns,
} = dbPackage;

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1);
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100);
  return { page, perPage, offset: (page - 1) * perPage };
}

async function createCustomerOpsRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0];
  bizId: string;
  tableKey: string;
  subjectType: string;
  data: Record<string, unknown>;
  displayName?: string;
}): Promise<T> {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: "create",
    subjectType: input.subjectType,
    displayName: input.displayName,
    data: input.data,
    metadata: { routeFamily: "customer-ops" },
  });
  if (!delegated.ok) {
    throw fail(
      input.c,
      delegated.code,
      delegated.message,
      delegated.httpStatus,
      delegated.details,
    );
  }
  return delegated.row as T;
}

async function updateCustomerOpsRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0];
  bizId: string;
  tableKey: string;
  subjectType: string;
  id: string;
  patch: Record<string, unknown>;
  notFoundMessage: string;
}): Promise<T> {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: "update",
    id: input.id,
    subjectType: input.subjectType,
    subjectId: input.id,
    patch: input.patch,
    metadata: { routeFamily: "customer-ops" },
  });
  if (!delegated.ok) {
    if (delegated.code === "CRUD_TARGET_NOT_FOUND") {
      throw fail(input.c, "NOT_FOUND", input.notFoundMessage, 404);
    }
    throw fail(
      input.c,
      delegated.code,
      delegated.message,
      delegated.httpStatus,
      delegated.details,
    );
  }
  if (!delegated.row) throw fail(input.c, "NOT_FOUND", input.notFoundMessage, 404);
  return delegated.row as T;
}

const pagedQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
});

const customerProfileStatuses = ["shadow", "claimed", "merged", "archived"] as const;
const customerIdentityHandleStatuses = ["active", "inactive", "suspended", "archived"] as const;

const customerProfileCreateSchema = z.object({
  status: z.enum(customerProfileStatuses).default("shadow"),
  displayName: z.string().max(240).optional(),
  primaryEmail: z.string().email().max(320).optional(),
  primaryPhone: z.string().max(40).optional(),
  claimedUserId: z.string().optional(),
  primaryCrmContactId: z.string().optional(),
  isVerified: z.boolean().default(false),
  lifecycleStage: z.string().max(40).default("prospect"),
  supportTier: z.string().max(40).default("standard"),
  acquisitionSourceType: z.string().max(80).optional(),
  acquisitionSourceRef: z.string().max(220).optional(),
  firstSeenAt: z.string().datetime().optional(),
  lastSeenAt: z.string().datetime().optional(),
  lastEngagedAt: z.string().datetime().optional(),
  lastPurchaseAt: z.string().datetime().optional(),
  profileData: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const customerProfilePatchSchema = customerProfileCreateSchema.partial();

const customerIdentityHandleCreateSchema = z.object({
  handleType: z.string().min(1).max(60),
  normalizedValue: z.string().min(1).max(500),
  displayValue: z.string().max(500).optional(),
  status: z.enum(customerIdentityHandleStatuses).default("active"),
  metadata: z.record(z.unknown()).optional(),
});

const customerIdentityLinkCreateSchema = z.object({
  customerIdentityHandleId: z.string().min(1),
  clientInstallationId: z.string().optional(),
  linkSource: z.string().min(1).max(60),
  confidenceLevel: z.string().max(32).default("asserted"),
  verificationState: z.string().max(32).default("unverified"),
  isPrimary: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

const customerProfileCrmLinkCreateSchema = z.object({
  crmContactId: z.string().min(1),
  linkType: z.string().max(40).default("primary"),
  isPrimary: z.boolean().default(false),
  note: z.string().max(1000).optional(),
});

const customerTimelineEventCreateSchema = z.object({
  eventType: z.string().min(1).max(80),
  title: z.string().min(1).max(260),
  summary: z.string().max(5000).optional(),
  sourceDomain: z.string().min(1).max(60),
  sourceEntityType: z.string().max(80).optional(),
  sourceEntityId: z.string().optional(),
  isCustomerVisible: z.boolean().default(false),
  importance: z.number().int().min(0).default(100),
  occurredAt: z.string().datetime().optional(),
  payload: z.record(z.unknown()).optional(),
});

const supportCaseCreateSchema = z.object({
  customerProfileId: z.string().min(1),
  crmContactId: z.string().optional(),
  crmConversationId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  paymentTransactionId: z.string().optional(),
  slaPolicyId: z.string().optional(),
  caseType: z.string().min(1).max(60),
  status: z.string().max(40).default("new"),
  priority: z.string().max(24).default("normal"),
  severityLevel: z.number().int().min(1).max(5).default(2),
  channelType: z.string().max(40).default("in_app"),
  title: z.string().min(1).max(260),
  description: z.string().max(5000).optional(),
  ownerUserId: z.string().optional(),
  assignedUserId: z.string().optional(),
  queueRef: z.string().max(160).optional(),
  firstResponseDueAt: z.string().datetime().optional(),
  nextResponseDueAt: z.string().datetime().optional(),
  resolutionDueAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const supportCasePatchSchema = z.object({
  status: z.string().max(40).optional(),
  priority: z.string().max(24).optional(),
  severityLevel: z.number().int().min(1).max(5).optional(),
  ownerUserId: z.string().optional(),
  assignedUserId: z.string().optional(),
  queueRef: z.string().max(160).optional(),
  firstRespondedAt: z.string().datetime().optional().nullable(),
  resolvedAt: z.string().datetime().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
  csatScore: z.number().int().min(1).max(5).optional().nullable(),
  npsScore: z.number().int().min(-100).max(100).optional().nullable(),
  resolutionType: z.string().max(80).optional().nullable(),
  resolutionSummary: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const supportCaseEventCreateSchema = z.object({
  eventType: z.string().min(1).max(80),
  actorType: z.string().max(40).default("system"),
  actorUserId: z.string().optional(),
  actorCustomerProfileId: z.string().optional(),
  actorLabel: z.string().max(200).optional(),
  fromStatus: z.string().max(40).optional(),
  toStatus: z.string().max(40).optional(),
  note: z.string().max(5000).optional(),
  occurredAt: z.string().datetime().optional(),
  payload: z.record(z.unknown()).optional(),
});

const supportCaseParticipantCreateSchema = z.object({
  participantType: z.string().min(1).max(40),
  role: z.string().min(1).max(40),
  userId: z.string().optional(),
  customerProfileId: z.string().optional(),
  externalRef: z.string().max(220).optional(),
  isPrimary: z.boolean().default(false),
  joinedAt: z.string().datetime().optional(),
  leftAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const supportCaseLinkCreateSchema = z.object({
  targetType: z.string().min(1).max(80),
  targetId: z.string().min(1),
  relationType: z.string().max(60).default("about"),
  metadata: z.record(z.unknown()).optional(),
});

const customerProfileMergeQuerySchema = z.object({
  customerProfileId: z.string().optional(),
});

const customerProfileMergeCreateSchema = z.object({
  sourceCustomerProfileId: z.string().min(1),
  targetCustomerProfileId: z.string().min(1),
  mergeReason: z.string().min(1).max(2000),
  mergeSummary: z.record(z.unknown()).optional(),
});

const customerJourneyCreateSchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("active"),
  journeyType: z.string().max(60).default("lifecycle"),
  entryPolicy: z.record(z.unknown()).optional(),
  exitPolicy: z.record(z.unknown()).optional(),
  suppressionPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const customerJourneyPatchSchema = customerJourneyCreateSchema.partial();

const customerJourneyStepCreateSchema = z.object({
  customerJourneyId: z.string().min(1),
  stepKey: z.string().min(1).max(140),
  name: z.string().min(1).max(220),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("active"),
  stepType: z.string().min(1).max(80),
  sequence: z.number().int().min(0).default(100),
  waitDurationMinutes: z.number().int().min(0).optional(),
  channelType: z.string().max(40).optional(),
  messageTemplateId: z.string().optional(),
  actionPolicy: z.record(z.unknown()).optional(),
  successNextStepKey: z.string().max(140).optional(),
  failureNextStepKey: z.string().max(140).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const customerJourneyEnrollmentCreateSchema = z.object({
  customerJourneyId: z.string().min(1),
  customerProfileId: z.string().min(1),
  status: z.string().max(40).default("queued"),
  currentStepId: z.string().optional(),
  sourceType: z.string().max(60).default("trigger"),
  sourceRef: z.string().max(220).optional(),
  enteredAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const customerJourneyEnrollmentPatchSchema = z.object({
  status: z.string().max(40).optional(),
  currentStepId: z.string().optional().nullable(),
  lastStepAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  touchCount: z.number().int().min(0).optional(),
  conversionCount: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const customerJourneyEventCreateSchema = z.object({
  customerJourneyEnrollmentId: z.string().min(1),
  customerJourneyStepId: z.string().optional(),
  eventType: z.string().min(1).max(80),
  occurredAt: z.string().datetime().optional(),
  outboundMessageId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

const customerPlaybookCreateSchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("active"),
  domain: z.string().max(40).default("cross_domain"),
  triggerType: z.string().max(40).default("event"),
  triggerConfig: z.record(z.unknown()).optional(),
  decisionPolicy: z.record(z.unknown()).optional(),
  actionPlan: z.record(z.unknown()).optional(),
  requiresApproval: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const customerPlaybookPatchSchema = customerPlaybookCreateSchema.partial();

const customerPlaybookBindingCreateSchema = z.object({
  customerPlaybookId: z.string().min(1),
  targetType: z.string().min(1).max(80),
  targetId: z.string().min(1),
  priority: z.number().int().min(0).default(100),
  isEnabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const customerPlaybookRunCreateSchema = z.object({
  customerPlaybookId: z.string().min(1),
  customerProfileId: z.string().optional(),
  supportCaseId: z.string().optional(),
  crmOpportunityId: z.string().optional(),
  status: z.string().max(40).default("queued"),
  requestedByUserId: z.string().optional(),
  executorType: z.string().max(40).default("agent"),
  executorRef: z.string().max(200).optional(),
  startedAt: z.string().datetime().optional(),
  inputPayload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const crmActivityCreateSchema = z.object({
  customerProfileId: z.string().optional(),
  crmContactId: z.string().optional(),
  crmLeadId: z.string().optional(),
  crmOpportunityId: z.string().optional(),
  supportCaseId: z.string().optional(),
  crmConversationId: z.string().optional(),
  outboundMessageId: z.string().optional(),
  activityType: z.string().min(1).max(60),
  direction: z.string().max(32).default("internal"),
  status: z.string().max(32).default("done"),
  title: z.string().min(1).max(260),
  body: z.string().max(5000).optional(),
  ownerUserId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  outcomeType: z.string().max(80).optional(),
  payload: z.record(z.unknown()).optional(),
});

const crmTaskCreateSchema = z.object({
  customerProfileId: z.string().optional(),
  crmContactId: z.string().optional(),
  crmLeadId: z.string().optional(),
  crmOpportunityId: z.string().optional(),
  supportCaseId: z.string().optional(),
  title: z.string().min(1).max(260),
  description: z.string().max(5000).optional(),
  status: z.string().max(32).default("open"),
  priority: z.string().max(32).default("normal"),
  assignedUserId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const crmTaskPatchSchema = crmTaskCreateSchema.partial();

export const customerOpsRoutes = new Hono();

customerOpsRoutes.get(
  "/bizes/:bizId/customer-profiles",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = pagedQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query.", 400, parsed.error.flatten());
    const { page, perPage, offset } = pagination(parsed.data);
    const where = eq(customerProfiles.bizId, bizId);
    const [rows, countRows] = await Promise.all([
      db.query.customerProfiles.findMany({
        where,
        orderBy: [desc(customerProfiles.firstSeenAt)],
        limit: perPage,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(customerProfiles).where(where),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return ok(c, rows, 200, { pagination: { page, perPage, total, hasMore: page * perPage < total } });
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-profiles",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerProfileCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer profile body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerProfiles.$inferSelect>({
      c,
      bizId,
      tableKey: "customerProfiles",
      subjectType: "customer_profile",
      displayName: parsed.data.displayName,
      data: {
        bizId,
        status: parsed.data.status,
        displayName: parsed.data.displayName ? sanitizePlainText(parsed.data.displayName) : null,
        primaryEmail: parsed.data.primaryEmail?.toLowerCase() ?? null,
        primaryPhone: parsed.data.primaryPhone ? sanitizePlainText(parsed.data.primaryPhone) : null,
        claimedUserId: parsed.data.claimedUserId ?? null,
        primaryCrmContactId: parsed.data.primaryCrmContactId ?? null,
        isVerified: parsed.data.isVerified,
        lifecycleStage: parsed.data.lifecycleStage,
        supportTier: parsed.data.supportTier,
        acquisitionSourceType: parsed.data.acquisitionSourceType ? sanitizePlainText(parsed.data.acquisitionSourceType) : null,
        acquisitionSourceRef: parsed.data.acquisitionSourceRef ? sanitizePlainText(parsed.data.acquisitionSourceRef) : null,
        firstSeenAt: parsed.data.firstSeenAt ? new Date(parsed.data.firstSeenAt) : new Date(),
        lastSeenAt: parsed.data.lastSeenAt ? new Date(parsed.data.lastSeenAt) : null,
        lastEngagedAt: parsed.data.lastEngagedAt ? new Date(parsed.data.lastEngagedAt) : null,
        lastPurchaseAt: parsed.data.lastPurchaseAt ? new Date(parsed.data.lastPurchaseAt) : null,
        profileData: sanitizeUnknown(parsed.data.profileData ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-profiles/:profileId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const profileId = c.req.param("profileId");
    const row = await db.query.customerProfiles.findFirst({
      where: and(eq(customerProfiles.bizId, bizId), eq(customerProfiles.id, profileId)),
    });
    if (!row) return fail(c, "NOT_FOUND", "Customer profile not found.", 404);
    return ok(c, row);
  },
);

customerOpsRoutes.patch(
  "/bizes/:bizId/customer-profiles/:profileId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const profileId = c.req.param("profileId");
    const parsed = customerProfilePatchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer profile patch.", 400, parsed.error.flatten());
    const updated = await updateCustomerOpsRow<typeof customerProfiles.$inferSelect>({
      c,
      bizId,
      tableKey: "customerProfiles",
      subjectType: "customer_profile",
      id: profileId,
      notFoundMessage: "Customer profile not found.",
      patch: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName ? sanitizePlainText(parsed.data.displayName) : null } : {}),
        ...(parsed.data.primaryEmail !== undefined ? { primaryEmail: parsed.data.primaryEmail ? parsed.data.primaryEmail.toLowerCase() : null } : {}),
        ...(parsed.data.primaryPhone !== undefined ? { primaryPhone: parsed.data.primaryPhone ? sanitizePlainText(parsed.data.primaryPhone) : null } : {}),
        ...(parsed.data.claimedUserId !== undefined ? { claimedUserId: parsed.data.claimedUserId ?? null } : {}),
        ...(parsed.data.primaryCrmContactId !== undefined ? { primaryCrmContactId: parsed.data.primaryCrmContactId ?? null } : {}),
        ...(parsed.data.isVerified !== undefined ? { isVerified: parsed.data.isVerified } : {}),
        ...(parsed.data.lifecycleStage !== undefined ? { lifecycleStage: parsed.data.lifecycleStage } : {}),
        ...(parsed.data.supportTier !== undefined ? { supportTier: parsed.data.supportTier } : {}),
        ...(parsed.data.acquisitionSourceType !== undefined ? { acquisitionSourceType: parsed.data.acquisitionSourceType ? sanitizePlainText(parsed.data.acquisitionSourceType) : null } : {}),
        ...(parsed.data.acquisitionSourceRef !== undefined ? { acquisitionSourceRef: parsed.data.acquisitionSourceRef ? sanitizePlainText(parsed.data.acquisitionSourceRef) : null } : {}),
        ...(parsed.data.firstSeenAt !== undefined ? { firstSeenAt: parsed.data.firstSeenAt ? new Date(parsed.data.firstSeenAt) : null } : {}),
        ...(parsed.data.lastSeenAt !== undefined ? { lastSeenAt: parsed.data.lastSeenAt ? new Date(parsed.data.lastSeenAt) : null } : {}),
        ...(parsed.data.lastEngagedAt !== undefined ? { lastEngagedAt: parsed.data.lastEngagedAt ? new Date(parsed.data.lastEngagedAt) : null } : {}),
        ...(parsed.data.lastPurchaseAt !== undefined ? { lastPurchaseAt: parsed.data.lastPurchaseAt ? new Date(parsed.data.lastPurchaseAt) : null } : {}),
        ...(parsed.data.profileData !== undefined ? { profileData: sanitizeUnknown(parsed.data.profileData ?? {}) } : {}),
        ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
      },
    } as any);
    return ok(c, updated);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-profiles/:profileId/identities",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const profileId = c.req.param("profileId");
    const handles = await db.query.customerIdentityLinks.findMany({
      where: and(eq(customerIdentityLinks.bizId, bizId), eq(customerIdentityLinks.customerProfileId, profileId)),
      orderBy: [desc(customerIdentityLinks.id)],
    });
    return ok(c, handles);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-profiles/:profileId/identities",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const profileId = c.req.param("profileId");
    const body = await c.req.json().catch(() => null);
    const handleParsed = customerIdentityHandleCreateSchema.safeParse(body?.handle ?? body);
    const linkParsed = customerIdentityLinkCreateSchema.safeParse(body?.link ?? body);
    if (!handleParsed.success) return fail(c, "VALIDATION_ERROR", "Invalid identity handle body.", 400, handleParsed.error.flatten());
    if (!linkParsed.success) return fail(c, "VALIDATION_ERROR", "Invalid identity link body.", 400, linkParsed.error.flatten());

    const createdHandle = await createCustomerOpsRow<typeof customerIdentityHandles.$inferSelect>({
      c,
      bizId,
      tableKey: "customerIdentityHandles",
      subjectType: "customer_identity_handle",
      displayName: handleParsed.data.displayValue,
      data: {
        bizId,
        handleType: sanitizePlainText(handleParsed.data.handleType),
        normalizedValue: sanitizePlainText(handleParsed.data.normalizedValue),
        displayValue: handleParsed.data.displayValue ? sanitizePlainText(handleParsed.data.displayValue) : null,
        status: handleParsed.data.status,
        metadata: sanitizeUnknown(handleParsed.data.metadata ?? {}),
      },
    });

    const createdLink = await createCustomerOpsRow<typeof customerIdentityLinks.$inferSelect>({
      c,
      bizId,
      tableKey: "customerIdentityLinks",
      subjectType: "customer_identity_link",
      data: {
        bizId,
        customerProfileId: profileId,
        customerIdentityHandleId: createdHandle.id,
        clientInstallationId: linkParsed.data.clientInstallationId ?? null,
        linkSource: sanitizePlainText(linkParsed.data.linkSource),
        confidenceLevel: linkParsed.data.confidenceLevel,
        verificationState: linkParsed.data.verificationState,
        isPrimary: linkParsed.data.isPrimary,
        metadata: sanitizeUnknown(linkParsed.data.metadata ?? {}),
      },
    });

    return ok(c, { handle: createdHandle, link: createdLink }, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-profiles/:profileId/crm-links",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const profileId = c.req.param("profileId");
    const rows = await db.query.customerProfileCrmLinks.findMany({
      where: and(eq(customerProfileCrmLinks.bizId, bizId), eq(customerProfileCrmLinks.customerProfileId, profileId)),
      orderBy: [desc(customerProfileCrmLinks.isPrimary), desc(customerProfileCrmLinks.id)],
    });
    return ok(c, rows);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-profiles/:profileId/crm-links",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const profileId = c.req.param("profileId");
    const parsed = customerProfileCrmLinkCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid profile CRM link body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerProfileCrmLinks.$inferSelect>({
      c,
      bizId,
      tableKey: "customerProfileCrmLinks",
      subjectType: "customer_profile_crm_link",
      data: {
        bizId,
        customerProfileId: profileId,
        crmContactId: parsed.data.crmContactId,
        linkType: parsed.data.linkType,
        isPrimary: parsed.data.isPrimary,
        note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-profiles/:profileId/timeline",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const profileId = c.req.param("profileId");
    const parsed = pagedQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query.", 400, parsed.error.flatten());
    const { page, perPage, offset } = pagination(parsed.data);
    const where = and(eq(customerTimelineEvents.bizId, bizId), eq(customerTimelineEvents.customerProfileId, profileId));
    const [rows, countRows] = await Promise.all([
      db.query.customerTimelineEvents.findMany({
        where,
        orderBy: [desc(customerTimelineEvents.occurredAt)],
        limit: perPage,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(customerTimelineEvents).where(where),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return ok(c, rows, 200, { pagination: { page, perPage, total, hasMore: page * perPage < total } });
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-profiles/:profileId/timeline",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const profileId = c.req.param("profileId");
    const parsed = customerTimelineEventCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer timeline event body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerTimelineEvents.$inferSelect>({
      c,
      bizId,
      tableKey: "customerTimelineEvents",
      subjectType: "customer_timeline_event",
      displayName: parsed.data.title,
      data: {
        bizId,
        customerProfileId: profileId,
        eventType: sanitizePlainText(parsed.data.eventType),
        title: sanitizePlainText(parsed.data.title),
        summary: parsed.data.summary ? sanitizePlainText(parsed.data.summary) : null,
        sourceDomain: sanitizePlainText(parsed.data.sourceDomain),
        sourceEntityType: parsed.data.sourceEntityType ? sanitizePlainText(parsed.data.sourceEntityType) : null,
        sourceEntityId: parsed.data.sourceEntityId ?? null,
        isCustomerVisible: parsed.data.isCustomerVisible,
        importance: parsed.data.importance,
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
        payload: sanitizeUnknown(parsed.data.payload ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/support-cases",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = pagedQuerySchema.extend({
      status: z.string().optional(),
      priority: z.string().optional(),
      assignedUserId: z.string().optional(),
      customerProfileId: z.string().optional(),
    }).safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query.", 400, parsed.error.flatten());
    const { page, perPage, offset } = pagination(parsed.data);
    const where = and(
      eq(supportCases.bizId, bizId),
      parsed.data.status ? eq(supportCases.status, parsed.data.status) : undefined,
      parsed.data.priority ? eq(supportCases.priority, parsed.data.priority) : undefined,
      parsed.data.assignedUserId ? eq(supportCases.assignedUserId, parsed.data.assignedUserId) : undefined,
      parsed.data.customerProfileId ? eq(supportCases.customerProfileId, parsed.data.customerProfileId) : undefined,
    );
    const [rows, countRows] = await Promise.all([
      db.query.supportCases.findMany({
        where,
        orderBy: [desc(supportCases.openedAt)],
        limit: perPage,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(supportCases).where(where),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return ok(c, rows, 200, { pagination: { page, perPage, total, hasMore: page * perPage < total } });
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/support-cases",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = supportCaseCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid support case body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof supportCases.$inferSelect>({
      c,
      bizId,
      tableKey: "supportCases",
      subjectType: "support_case",
      displayName: parsed.data.title,
      data: {
        bizId,
        customerProfileId: parsed.data.customerProfileId,
        crmContactId: parsed.data.crmContactId ?? null,
        crmConversationId: parsed.data.crmConversationId ?? null,
        bookingOrderId: parsed.data.bookingOrderId ?? null,
        paymentTransactionId: parsed.data.paymentTransactionId ?? null,
        slaPolicyId: parsed.data.slaPolicyId ?? null,
        caseType: sanitizePlainText(parsed.data.caseType),
        status: parsed.data.status,
        priority: parsed.data.priority,
        severityLevel: parsed.data.severityLevel,
        channelType: sanitizePlainText(parsed.data.channelType),
        title: sanitizePlainText(parsed.data.title),
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        ownerUserId: parsed.data.ownerUserId ?? null,
        assignedUserId: parsed.data.assignedUserId ?? null,
        queueRef: parsed.data.queueRef ? sanitizePlainText(parsed.data.queueRef) : null,
        firstResponseDueAt: parsed.data.firstResponseDueAt ? new Date(parsed.data.firstResponseDueAt) : null,
        nextResponseDueAt: parsed.data.nextResponseDueAt ? new Date(parsed.data.nextResponseDueAt) : null,
        resolutionDueAt: parsed.data.resolutionDueAt ? new Date(parsed.data.resolutionDueAt) : null,
        tags: sanitizeUnknown(parsed.data.tags ?? []),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/support-cases/:caseId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const caseId = c.req.param("caseId");
    const row = await db.query.supportCases.findFirst({
      where: and(eq(supportCases.bizId, bizId), eq(supportCases.id, caseId)),
    });
    if (!row) return fail(c, "NOT_FOUND", "Support case not found.", 404);
    return ok(c, row);
  },
);

customerOpsRoutes.patch(
  "/bizes/:bizId/support-cases/:caseId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const caseId = c.req.param("caseId");
    const parsed = supportCasePatchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid support case patch body.", 400, parsed.error.flatten());
    const updated = await updateCustomerOpsRow<typeof supportCases.$inferSelect>({
      c,
      bizId,
      tableKey: "supportCases",
      subjectType: "support_case",
      id: caseId,
      notFoundMessage: "Support case not found.",
      patch: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.severityLevel !== undefined ? { severityLevel: parsed.data.severityLevel } : {}),
        ...(parsed.data.ownerUserId !== undefined ? { ownerUserId: parsed.data.ownerUserId ?? null } : {}),
        ...(parsed.data.assignedUserId !== undefined ? { assignedUserId: parsed.data.assignedUserId ?? null } : {}),
        ...(parsed.data.queueRef !== undefined ? { queueRef: parsed.data.queueRef ? sanitizePlainText(parsed.data.queueRef) : null } : {}),
        ...(parsed.data.firstRespondedAt !== undefined ? { firstRespondedAt: parsed.data.firstRespondedAt ? new Date(parsed.data.firstRespondedAt) : null } : {}),
        ...(parsed.data.resolvedAt !== undefined ? { resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null } : {}),
        ...(parsed.data.closedAt !== undefined ? { closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null } : {}),
        ...(parsed.data.csatScore !== undefined ? { csatScore: parsed.data.csatScore ?? null } : {}),
        ...(parsed.data.npsScore !== undefined ? { npsScore: parsed.data.npsScore ?? null } : {}),
        ...(parsed.data.resolutionType !== undefined ? { resolutionType: parsed.data.resolutionType ? sanitizePlainText(parsed.data.resolutionType) : null } : {}),
        ...(parsed.data.resolutionSummary !== undefined ? { resolutionSummary: parsed.data.resolutionSummary ? sanitizePlainText(parsed.data.resolutionSummary) : null } : {}),
        ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
      },
    });
    return ok(c, updated);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/support-cases/:caseId/events",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const caseId = c.req.param("caseId");
    const rows = await db.query.supportCaseEvents.findMany({
      where: and(eq(supportCaseEvents.bizId, bizId), eq(supportCaseEvents.supportCaseId, caseId)),
      orderBy: [asc(supportCaseEvents.occurredAt)],
    });
    return ok(c, rows);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/support-cases/:caseId/events",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const caseId = c.req.param("caseId");
    const parsed = supportCaseEventCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid support case event body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof supportCaseEvents.$inferSelect>({
      c,
      bizId,
      tableKey: "supportCaseEvents",
      subjectType: "support_case_event",
      data: {
        bizId,
        supportCaseId: caseId,
        eventType: sanitizePlainText(parsed.data.eventType),
        actorType: sanitizePlainText(parsed.data.actorType),
        actorUserId: parsed.data.actorUserId ?? null,
        actorCustomerProfileId: parsed.data.actorCustomerProfileId ?? null,
        actorLabel: parsed.data.actorLabel ? sanitizePlainText(parsed.data.actorLabel) : null,
        fromStatus: parsed.data.fromStatus ?? null,
        toStatus: parsed.data.toStatus ?? null,
        note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
        payload: sanitizeUnknown(parsed.data.payload ?? {}),
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/support-cases/:caseId/participants",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const caseId = c.req.param("caseId");
    const parsed = supportCaseParticipantCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid support case participant body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof supportCaseParticipants.$inferSelect>({
      c,
      bizId,
      tableKey: "supportCaseParticipants",
      subjectType: "support_case_participant",
      data: {
        bizId,
        supportCaseId: caseId,
        participantType: sanitizePlainText(parsed.data.participantType),
        role: sanitizePlainText(parsed.data.role),
        userId: parsed.data.userId ?? null,
        customerProfileId: parsed.data.customerProfileId ?? null,
        externalRef: parsed.data.externalRef ? sanitizePlainText(parsed.data.externalRef) : null,
        isPrimary: parsed.data.isPrimary,
        joinedAt: parsed.data.joinedAt ? new Date(parsed.data.joinedAt) : new Date(),
        leftAt: parsed.data.leftAt ? new Date(parsed.data.leftAt) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/support-cases/:caseId/links",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const caseId = c.req.param("caseId");
    const parsed = supportCaseLinkCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid support case link body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof supportCaseLinks.$inferSelect>({
      c,
      bizId,
      tableKey: "supportCaseLinks",
      subjectType: "support_case_link",
      data: {
        bizId,
        supportCaseId: caseId,
        targetType: sanitizePlainText(parsed.data.targetType),
        targetId: parsed.data.targetId,
        relationType: sanitizePlainText(parsed.data.relationType),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/support-cases/:caseId/participants",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const caseId = c.req.param("caseId");
    const rows = await db.query.supportCaseParticipants.findMany({
      where: and(eq(supportCaseParticipants.bizId, bizId), eq(supportCaseParticipants.supportCaseId, caseId)),
      orderBy: [desc(supportCaseParticipants.joinedAt)],
    });
    return ok(c, rows);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/support-cases/:caseId/links",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const caseId = c.req.param("caseId");
    const rows = await db.query.supportCaseLinks.findMany({
      where: and(eq(supportCaseLinks.bizId, bizId), eq(supportCaseLinks.supportCaseId, caseId)),
      orderBy: [desc(supportCaseLinks.id)],
    });
    return ok(c, rows);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-profile-merges",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerProfileMergeQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query.", 400, parsed.error.flatten());
    const rows = await db.query.customerProfileMerges.findMany({
      where: and(
        eq(customerProfileMerges.bizId, bizId),
        parsed.data.customerProfileId
          ? or(
              eq(customerProfileMerges.sourceCustomerProfileId, parsed.data.customerProfileId),
              eq(customerProfileMerges.targetCustomerProfileId, parsed.data.customerProfileId),
            )
          : undefined,
      ),
      orderBy: [desc(customerProfileMerges.id)],
    });
    return ok(c, rows);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-profile-merges",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerProfileMergeCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer profile merge body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerProfileMerges.$inferSelect>({
      c,
      bizId,
      tableKey: "customerProfileMerges",
      subjectType: "customer_profile_merge",
      data: {
        bizId,
        sourceCustomerProfileId: parsed.data.sourceCustomerProfileId,
        targetCustomerProfileId: parsed.data.targetCustomerProfileId,
        mergeReason: sanitizePlainText(parsed.data.mergeReason),
        mergeSummary: sanitizeUnknown(parsed.data.mergeSummary ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-journeys",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const rows = await db.query.customerJourneys.findMany({
      where: eq(customerJourneys.bizId, bizId),
      orderBy: [asc(customerJourneys.name)],
    });
    return ok(c, rows);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-journeys",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerJourneyCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer journey body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerJourneys.$inferSelect>({
      c,
      bizId,
      tableKey: "customerJourneys",
      subjectType: "customer_journey",
      displayName: parsed.data.name,
      data: {
        bizId,
        name: sanitizePlainText(parsed.data.name),
        slug: sanitizePlainText(parsed.data.slug),
        status: parsed.data.status,
        journeyType: sanitizePlainText(parsed.data.journeyType),
        entryPolicy: sanitizeUnknown(parsed.data.entryPolicy ?? {}),
        exitPolicy: sanitizeUnknown(parsed.data.exitPolicy ?? {}),
        suppressionPolicy: sanitizeUnknown(parsed.data.suppressionPolicy ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.patch(
  "/bizes/:bizId/customer-journeys/:journeyId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const journeyId = c.req.param("journeyId");
    const parsed = customerJourneyPatchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer journey patch.", 400, parsed.error.flatten());
    const updated = await updateCustomerOpsRow<typeof customerJourneys.$inferSelect>({
      c,
      bizId,
      tableKey: "customerJourneys",
      subjectType: "customer_journey",
      id: journeyId,
      notFoundMessage: "Customer journey not found.",
      patch: {
        ...(parsed.data.name !== undefined ? { name: sanitizePlainText(parsed.data.name) } : {}),
        ...(parsed.data.slug !== undefined ? { slug: sanitizePlainText(parsed.data.slug) } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.journeyType !== undefined ? { journeyType: sanitizePlainText(parsed.data.journeyType) } : {}),
        ...(parsed.data.entryPolicy !== undefined ? { entryPolicy: sanitizeUnknown(parsed.data.entryPolicy ?? {}) } : {}),
        ...(parsed.data.exitPolicy !== undefined ? { exitPolicy: sanitizeUnknown(parsed.data.exitPolicy ?? {}) } : {}),
        ...(parsed.data.suppressionPolicy !== undefined ? { suppressionPolicy: sanitizeUnknown(parsed.data.suppressionPolicy ?? {}) } : {}),
        ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
      },
    });
    return ok(c, updated);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-journeys/:journeyId/steps",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const journeyId = c.req.param("journeyId");
    const rows = await db.query.customerJourneySteps.findMany({
      where: and(eq(customerJourneySteps.bizId, bizId), eq(customerJourneySteps.customerJourneyId, journeyId)),
      orderBy: [asc(customerJourneySteps.sequence), asc(customerJourneySteps.stepKey)],
    });
    return ok(c, rows);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-journeys/:journeyId/steps",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const journeyId = c.req.param("journeyId");
    const parsed = customerJourneyStepCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer journey step body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerJourneySteps.$inferSelect>({
      c,
      bizId,
      tableKey: "customerJourneySteps",
      subjectType: "customer_journey_step",
      displayName: parsed.data.name,
      data: {
        bizId,
        customerJourneyId: journeyId,
        stepKey: sanitizePlainText(parsed.data.stepKey),
        name: sanitizePlainText(parsed.data.name),
        status: parsed.data.status,
        stepType: sanitizePlainText(parsed.data.stepType),
        sequence: parsed.data.sequence,
        waitDurationMinutes: parsed.data.waitDurationMinutes ?? null,
        channelType: parsed.data.channelType ? sanitizePlainText(parsed.data.channelType) : null,
        messageTemplateId: parsed.data.messageTemplateId ?? null,
        actionPolicy: sanitizeUnknown(parsed.data.actionPolicy ?? {}),
        successNextStepKey: parsed.data.successNextStepKey ? sanitizePlainText(parsed.data.successNextStepKey) : null,
        failureNextStepKey: parsed.data.failureNextStepKey ? sanitizePlainText(parsed.data.failureNextStepKey) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-journey-enrollments",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = pagedQuerySchema.extend({
      customerJourneyId: z.string().optional(),
      customerProfileId: z.string().optional(),
      status: z.string().optional(),
    }).safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query.", 400, parsed.error.flatten());
    const { page, perPage, offset } = pagination(parsed.data);
    const where = and(
      eq(customerJourneyEnrollments.bizId, bizId),
      parsed.data.customerJourneyId ? eq(customerJourneyEnrollments.customerJourneyId, parsed.data.customerJourneyId) : undefined,
      parsed.data.customerProfileId ? eq(customerJourneyEnrollments.customerProfileId, parsed.data.customerProfileId) : undefined,
      parsed.data.status ? eq(customerJourneyEnrollments.status, parsed.data.status) : undefined,
    );
    const [rows, countRows] = await Promise.all([
      db.query.customerJourneyEnrollments.findMany({
        where,
        orderBy: [desc(customerJourneyEnrollments.enteredAt)],
        limit: perPage,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(customerJourneyEnrollments).where(where),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return ok(c, rows, 200, { pagination: { page, perPage, total, hasMore: page * perPage < total } });
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-journey-enrollments",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerJourneyEnrollmentCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer journey enrollment body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerJourneyEnrollments.$inferSelect>({
      c,
      bizId,
      tableKey: "customerJourneyEnrollments",
      subjectType: "customer_journey_enrollment",
      data: {
        bizId,
        customerJourneyId: parsed.data.customerJourneyId,
        customerProfileId: parsed.data.customerProfileId,
        status: parsed.data.status,
        currentStepId: parsed.data.currentStepId ?? null,
        sourceType: sanitizePlainText(parsed.data.sourceType),
        sourceRef: parsed.data.sourceRef ? sanitizePlainText(parsed.data.sourceRef) : null,
        enteredAt: parsed.data.enteredAt ? new Date(parsed.data.enteredAt) : new Date(),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.patch(
  "/bizes/:bizId/customer-journey-enrollments/:enrollmentId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const enrollmentId = c.req.param("enrollmentId");
    const parsed = customerJourneyEnrollmentPatchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer journey enrollment patch.", 400, parsed.error.flatten());
    const updated = await updateCustomerOpsRow<typeof customerJourneyEnrollments.$inferSelect>({
      c,
      bizId,
      tableKey: "customerJourneyEnrollments",
      subjectType: "customer_journey_enrollment",
      id: enrollmentId,
      notFoundMessage: "Customer journey enrollment not found.",
      patch: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.currentStepId !== undefined ? { currentStepId: parsed.data.currentStepId ?? null } : {}),
        ...(parsed.data.lastStepAt !== undefined ? { lastStepAt: parsed.data.lastStepAt ? new Date(parsed.data.lastStepAt) : null } : {}),
        ...(parsed.data.completedAt !== undefined ? { completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null } : {}),
        ...(parsed.data.touchCount !== undefined ? { touchCount: parsed.data.touchCount } : {}),
        ...(parsed.data.conversionCount !== undefined ? { conversionCount: parsed.data.conversionCount } : {}),
        ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
      },
    });
    return ok(c, updated);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-journey-enrollment-events",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerJourneyEventCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer journey event body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerJourneyEvents.$inferSelect>({
      c,
      bizId,
      tableKey: "customerJourneyEvents",
      subjectType: "customer_journey_event",
      data: {
        bizId,
        customerJourneyEnrollmentId: parsed.data.customerJourneyEnrollmentId,
        customerJourneyStepId: parsed.data.customerJourneyStepId ?? null,
        eventType: sanitizePlainText(parsed.data.eventType),
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
        outboundMessageId: parsed.data.outboundMessageId ?? null,
        payload: sanitizeUnknown(parsed.data.payload ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/crm-activities",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = pagedQuerySchema.extend({
      customerProfileId: z.string().optional(),
      crmOpportunityId: z.string().optional(),
      ownerUserId: z.string().optional(),
      status: z.string().optional(),
    }).safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query.", 400, parsed.error.flatten());
    const { page, perPage, offset } = pagination(parsed.data);
    const where = and(
      eq(crmActivities.bizId, bizId),
      parsed.data.customerProfileId ? eq(crmActivities.customerProfileId, parsed.data.customerProfileId) : undefined,
      parsed.data.crmOpportunityId ? eq(crmActivities.crmOpportunityId, parsed.data.crmOpportunityId) : undefined,
      parsed.data.ownerUserId ? eq(crmActivities.ownerUserId, parsed.data.ownerUserId) : undefined,
      parsed.data.status ? eq(crmActivities.status, parsed.data.status) : undefined,
    );
    const [rows, countRows] = await Promise.all([
      db.query.crmActivities.findMany({
        where,
        orderBy: [desc(crmActivities.id)],
        limit: perPage,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(crmActivities).where(where),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return ok(c, rows, 200, { pagination: { page, perPage, total, hasMore: page * perPage < total } });
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/crm-activities",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = crmActivityCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid CRM activity body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof crmActivities.$inferSelect>({
      c,
      bizId,
      tableKey: "crmActivities",
      subjectType: "crm_activity",
      displayName: parsed.data.title,
      data: {
        bizId,
        customerProfileId: parsed.data.customerProfileId ?? null,
        crmContactId: parsed.data.crmContactId ?? null,
        crmLeadId: parsed.data.crmLeadId ?? null,
        crmOpportunityId: parsed.data.crmOpportunityId ?? null,
        supportCaseId: parsed.data.supportCaseId ?? null,
        crmConversationId: parsed.data.crmConversationId ?? null,
        outboundMessageId: parsed.data.outboundMessageId ?? null,
        activityType: sanitizePlainText(parsed.data.activityType),
        direction: sanitizePlainText(parsed.data.direction),
        status: sanitizePlainText(parsed.data.status),
        title: sanitizePlainText(parsed.data.title),
        body: parsed.data.body ? sanitizePlainText(parsed.data.body) : null,
        ownerUserId: parsed.data.ownerUserId ?? null,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
        durationMinutes: parsed.data.durationMinutes ?? null,
        outcomeType: parsed.data.outcomeType ? sanitizePlainText(parsed.data.outcomeType) : null,
        payload: sanitizeUnknown(parsed.data.payload ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/crm-tasks",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = pagedQuerySchema.extend({
      assignedUserId: z.string().optional(),
      crmLeadId: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
    }).safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query.", 400, parsed.error.flatten());
    const { page, perPage, offset } = pagination(parsed.data);
    const where = and(
      eq(crmTasks.bizId, bizId),
      parsed.data.assignedUserId ? eq(crmTasks.assignedUserId, parsed.data.assignedUserId) : undefined,
      parsed.data.crmLeadId ? eq(crmTasks.crmLeadId, parsed.data.crmLeadId) : undefined,
      parsed.data.status ? eq(crmTasks.status, parsed.data.status) : undefined,
      parsed.data.priority ? eq(crmTasks.priority, parsed.data.priority) : undefined,
    );
    const [rows, countRows] = await Promise.all([
      db.query.crmTasks.findMany({
        where,
        orderBy: [desc(crmTasks.id)],
        limit: perPage,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(crmTasks).where(where),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return ok(c, rows, 200, { pagination: { page, perPage, total, hasMore: page * perPage < total } });
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/crm-tasks",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = crmTaskCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid CRM task body.", 400, parsed.error.flatten());
    const delegated = await executeCrudRouteAction({
      c,
      bizId,
      tableKey: "crmTasks",
      operation: "create",
      subjectType: "crm_task",
      displayName: parsed.data.title,
      data: {
        bizId,
        customerProfileId: parsed.data.customerProfileId ?? null,
        crmContactId: parsed.data.crmContactId ?? null,
        crmLeadId: parsed.data.crmLeadId ?? null,
        crmOpportunityId: parsed.data.crmOpportunityId ?? null,
        supportCaseId: parsed.data.supportCaseId ?? null,
        title: sanitizePlainText(parsed.data.title),
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        status: sanitizePlainText(parsed.data.status),
        priority: sanitizePlainText(parsed.data.priority),
        assignedUserId: parsed.data.assignedUserId ?? null,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
        completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
      metadata: { routeFamily: "customer-ops" },
    });
    if (!delegated.ok) {
      return fail(c, delegated.code, delegated.message, delegated.httpStatus, delegated.details);
    }
    const created = delegated.row as typeof crmTasks.$inferSelect;
    return ok(c, created, 201);
  },
);

customerOpsRoutes.patch(
  "/bizes/:bizId/crm-tasks/:taskId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const taskId = c.req.param("taskId");
    const parsed = crmTaskPatchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid CRM task patch.", 400, parsed.error.flatten());
    const delegated = await executeCrudRouteAction({
      c,
      bizId,
      tableKey: "crmTasks",
      operation: "update",
      id: taskId,
      subjectType: "crm_task",
      subjectId: taskId,
      patch: {
        ...(parsed.data.customerProfileId !== undefined ? { customerProfileId: parsed.data.customerProfileId ?? null } : {}),
        ...(parsed.data.crmContactId !== undefined ? { crmContactId: parsed.data.crmContactId ?? null } : {}),
        ...(parsed.data.crmLeadId !== undefined ? { crmLeadId: parsed.data.crmLeadId ?? null } : {}),
        ...(parsed.data.crmOpportunityId !== undefined ? { crmOpportunityId: parsed.data.crmOpportunityId ?? null } : {}),
        ...(parsed.data.supportCaseId !== undefined ? { supportCaseId: parsed.data.supportCaseId ?? null } : {}),
        ...(parsed.data.title !== undefined ? { title: sanitizePlainText(parsed.data.title) } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null } : {}),
        ...(parsed.data.status !== undefined ? { status: sanitizePlainText(parsed.data.status) } : {}),
        ...(parsed.data.priority !== undefined ? { priority: sanitizePlainText(parsed.data.priority) } : {}),
        ...(parsed.data.assignedUserId !== undefined ? { assignedUserId: parsed.data.assignedUserId ?? null } : {}),
        ...(parsed.data.dueAt !== undefined ? { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null } : {}),
        ...(parsed.data.startedAt !== undefined ? { startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null } : {}),
        ...(parsed.data.completedAt !== undefined ? { completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null } : {}),
        ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
      },
      metadata: { routeFamily: "customer-ops" },
    });
    if (!delegated.ok) {
      if (delegated.code === "CRUD_TARGET_NOT_FOUND") {
        return fail(c, "NOT_FOUND", "CRM task not found.", 404);
      }
      return fail(c, delegated.code, delegated.message, delegated.httpStatus, delegated.details);
    }
    const updated = delegated.row as typeof crmTasks.$inferSelect;
    return ok(c, updated);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-playbooks",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const rows = await db.query.customerPlaybooks.findMany({
      where: eq(customerPlaybooks.bizId, bizId),
      orderBy: [asc(customerPlaybooks.name)],
    });
    return ok(c, rows);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-playbooks",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerPlaybookCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer playbook body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerPlaybooks.$inferSelect>({
      c,
      bizId,
      tableKey: "customerPlaybooks",
      subjectType: "customer_playbook",
      displayName: parsed.data.name,
      data: {
        bizId,
        name: sanitizePlainText(parsed.data.name),
        slug: sanitizePlainText(parsed.data.slug),
        status: parsed.data.status,
        domain: sanitizePlainText(parsed.data.domain),
        triggerType: sanitizePlainText(parsed.data.triggerType),
        triggerConfig: sanitizeUnknown(parsed.data.triggerConfig ?? {}),
        decisionPolicy: sanitizeUnknown(parsed.data.decisionPolicy ?? {}),
        actionPlan: sanitizeUnknown(parsed.data.actionPlan ?? {}),
        requiresApproval: parsed.data.requiresApproval,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.patch(
  "/bizes/:bizId/customer-playbooks/:playbookId",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const playbookId = c.req.param("playbookId");
    const parsed = customerPlaybookPatchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer playbook patch.", 400, parsed.error.flatten());
    const updated = await updateCustomerOpsRow<typeof customerPlaybooks.$inferSelect>({
      c,
      bizId,
      tableKey: "customerPlaybooks",
      subjectType: "customer_playbook",
      id: playbookId,
      notFoundMessage: "Customer playbook not found.",
      patch: {
        ...(parsed.data.name !== undefined ? { name: sanitizePlainText(parsed.data.name) } : {}),
        ...(parsed.data.slug !== undefined ? { slug: sanitizePlainText(parsed.data.slug) } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.domain !== undefined ? { domain: sanitizePlainText(parsed.data.domain) } : {}),
        ...(parsed.data.triggerType !== undefined ? { triggerType: sanitizePlainText(parsed.data.triggerType) } : {}),
        ...(parsed.data.triggerConfig !== undefined ? { triggerConfig: sanitizeUnknown(parsed.data.triggerConfig ?? {}) } : {}),
        ...(parsed.data.decisionPolicy !== undefined ? { decisionPolicy: sanitizeUnknown(parsed.data.decisionPolicy ?? {}) } : {}),
        ...(parsed.data.actionPlan !== undefined ? { actionPlan: sanitizeUnknown(parsed.data.actionPlan ?? {}) } : {}),
        ...(parsed.data.requiresApproval !== undefined ? { requiresApproval: parsed.data.requiresApproval } : {}),
        ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
      },
    });
    return ok(c, updated);
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-playbook-bindings",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerPlaybookBindingCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer playbook binding body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerPlaybookBindings.$inferSelect>({
      c,
      bizId,
      tableKey: "customerPlaybookBindings",
      subjectType: "customer_playbook_binding",
      data: {
        bizId,
        customerPlaybookId: parsed.data.customerPlaybookId,
        targetType: sanitizePlainText(parsed.data.targetType),
        targetId: parsed.data.targetId,
        priority: parsed.data.priority,
        isEnabled: parsed.data.isEnabled,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);

customerOpsRoutes.get(
  "/bizes/:bizId/customer-playbook-runs",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.read", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = pagedQuerySchema.extend({
      customerPlaybookId: z.string().optional(),
      status: z.string().optional(),
      customerProfileId: z.string().optional(),
    }).safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid query.", 400, parsed.error.flatten());
    const { page, perPage, offset } = pagination(parsed.data);
    const where = and(
      eq(customerPlaybookRuns.bizId, bizId),
      parsed.data.customerPlaybookId ? eq(customerPlaybookRuns.customerPlaybookId, parsed.data.customerPlaybookId) : undefined,
      parsed.data.status ? eq(customerPlaybookRuns.status, parsed.data.status) : undefined,
      parsed.data.customerProfileId ? eq(customerPlaybookRuns.customerProfileId, parsed.data.customerProfileId) : undefined,
    );
    const [rows, countRows] = await Promise.all([
      db.query.customerPlaybookRuns.findMany({
        where,
        orderBy: [desc(customerPlaybookRuns.startedAt)],
        limit: perPage,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` }).from(customerPlaybookRuns).where(where),
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return ok(c, rows, 200, { pagination: { page, perPage, total, hasMore: page * perPage < total } });
  },
);

customerOpsRoutes.post(
  "/bizes/:bizId/customer-playbook-runs",
  requireAuth,
  requireBizAccess("bizId"),
  requireAclPermission("bizes.update", { bizIdParam: "bizId" }),
  async (c) => {
    const bizId = c.req.param("bizId");
    const parsed = customerPlaybookRunCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "Invalid customer playbook run body.", 400, parsed.error.flatten());
    const created = await createCustomerOpsRow<typeof customerPlaybookRuns.$inferSelect>({
      c,
      bizId,
      tableKey: "customerPlaybookRuns",
      subjectType: "customer_playbook_run",
      data: {
        bizId,
        customerPlaybookId: parsed.data.customerPlaybookId,
        customerProfileId: parsed.data.customerProfileId ?? null,
        supportCaseId: parsed.data.supportCaseId ?? null,
        crmOpportunityId: parsed.data.crmOpportunityId ?? null,
        status: sanitizePlainText(parsed.data.status),
        requestedByUserId: parsed.data.requestedByUserId ?? null,
        executorType: sanitizePlainText(parsed.data.executorType),
        executorRef: parsed.data.executorRef ? sanitizePlainText(parsed.data.executorRef) : null,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : new Date(),
        inputPayload: sanitizeUnknown(parsed.data.inputPayload ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    });
    return ok(c, created, 201);
  },
);
