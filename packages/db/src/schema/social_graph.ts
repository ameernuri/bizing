import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { lifecycleStatusEnum } from "./enums";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * graph_identities
 *
 * ELI5:
 * This table creates one reusable "social identity card" for anything that can:
 * - follow,
 * - be followed,
 * - publish feed items,
 * - own audience policies.
 *
 * Why this exists:
 * - we do NOT hardcode separate "user_followers", "biz_followers", etc.
 * - one identity backbone stays fungible as new actor types are added.
 * - users and bizes both become first-class graph actors.
 *
 * Owner shapes:
 * - owner_type='user'   -> owner_user_id set
 * - owner_type='biz'    -> owner_biz_id set
 * - owner_type='subject'-> owner_subject_(biz/type/id) set
 *
 * "subject" gives us plugin/extensibility support without schema rewrites.
 */
export const graphIdentities = pgTable(
  "graph_identities",
  {
    /** Stable primary key for one graph identity. */
    id: idWithTag("graph_identity"),

    /**
     * Identity owner class.
     *
     * Keep as varchar + checks (instead of rigid enum) so we can add
     * `custom_*` owner classes later without enum migrations.
     */
    ownerType: varchar("owner_type", { length: 60 }).notNull(),

    /** Pointer when owner_type='user'. */
    ownerUserId: idRef("owner_user_id").references(() => users.id),

    /** Pointer when owner_type='biz'. */
    ownerBizId: idRef("owner_biz_id").references(() => bizes.id),

    /** Pointer when owner_type='subject'. */
    ownerSubjectBizId: idRef("owner_subject_biz_id"),
    ownerSubjectType: varchar("owner_subject_type", { length: 80 }),
    ownerSubjectId: varchar("owner_subject_id", { length: 140 }),

    /** Public handle used for profile URLs/lookups. */
    handle: varchar("handle", { length: 140 }).notNull(),

    /** Human-facing display name for this identity. */
    displayName: varchar("display_name", { length: 240 }),

    /** Shared lifecycle switch for discoverability and posting. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Search/discovery flag.
     * False means "existing followers can still resolve me, but hide from broad
     * discovery experiences unless policy allows otherwise."
     */
    isDiscoverable: boolean("is_discoverable").default(true).notNull(),

    /** Lightweight profile and extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Public handle should be globally unique within this deployment. */
    graphIdentitiesHandleUnique: uniqueIndex("graph_identities_handle_unique").on(
      table.handle,
    ),

    /** One graph identity per user owner. */
    graphIdentitiesOwnerUserUnique: uniqueIndex(
      "graph_identities_owner_user_unique",
    )
      .on(table.ownerUserId)
      .where(sql`"owner_user_id" IS NOT NULL`),

    /** One graph identity per biz owner. */
    graphIdentitiesOwnerBizUnique: uniqueIndex("graph_identities_owner_biz_unique")
      .on(table.ownerBizId)
      .where(sql`"owner_biz_id" IS NOT NULL`),

    /** One graph identity per subject owner. */
    graphIdentitiesOwnerSubjectUnique: uniqueIndex(
      "graph_identities_owner_subject_unique",
    )
      .on(table.ownerSubjectBizId, table.ownerSubjectType, table.ownerSubjectId)
      .where(
        sql`"owner_subject_biz_id" IS NOT NULL AND "owner_subject_type" IS NOT NULL AND "owner_subject_id" IS NOT NULL`,
      ),

    /** Common listing path by owner class and status. */
    graphIdentitiesOwnerTypeStatusIdx: index(
      "graph_identities_owner_type_status_idx",
    ).on(table.ownerType, table.status, table.isDiscoverable),

    /** Tenant-safe FK to optional subject owner pointer. */
    graphIdentitiesOwnerSubjectFk: foreignKey({
      columns: [table.ownerSubjectBizId, table.ownerSubjectType, table.ownerSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "graph_identities_owner_subject_fk",
    }),

    /** Non-empty handle and owner_type values. */
    graphIdentitiesKeyShapeCheck: check(
      "graph_identities_key_shape_check",
      sql`length("handle") > 0 AND length("owner_type") > 0`,
    ),

    /**
     * Owner payload shape check.
     *
     * This keeps identity ownership deterministic and easy to reason about.
     */
    graphIdentitiesOwnerShapeCheck: check(
      "graph_identities_owner_shape_check",
      sql`
      (
        "owner_type" = 'user'
        AND "owner_user_id" IS NOT NULL
        AND "owner_biz_id" IS NULL
        AND "owner_subject_biz_id" IS NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
      ) OR (
        "owner_type" = 'biz'
        AND "owner_user_id" IS NULL
        AND "owner_biz_id" IS NOT NULL
        AND "owner_subject_biz_id" IS NULL
        AND "owner_subject_type" IS NULL
        AND "owner_subject_id" IS NULL
      ) OR (
        "owner_type" = 'subject'
        AND "owner_user_id" IS NULL
        AND "owner_biz_id" IS NULL
        AND "owner_subject_biz_id" IS NOT NULL
        AND "owner_subject_type" IS NOT NULL
        AND "owner_subject_id" IS NOT NULL
      ) OR (
        "owner_type" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * graph_identity_policies
 *
 * ELI5:
 * One row = default privacy and relationship rules for one identity.
 *
 * This is where users/bizes control:
 * - can people follow me directly or need approval?
 * - who can see my profile by default?
 * - who can see my feed items by default?
 *
 * Per-item rules can still override defaults.
 */
export const graphIdentityPolicies = pgTable(
  "graph_identity_policies",
  {
    /** Stable primary key. */
    id: idWithTag("graph_policy"),

    /** Target identity that owns this policy. */
    identityId: idRef("identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /**
     * Follow gate mode.
     * - open: new follow edges can become active immediately
     * - approval_required: new follow edges start as pending
     * - closed: new follows are blocked by policy
     */
    followMode: varchar("follow_mode", { length: 60 })
      .default("open")
      .notNull(),

    /**
     * Default profile visibility.
     * - public / followers / mutuals / private
     */
    profileVisibilityMode: varchar("profile_visibility_mode", { length: 60 })
      .default("public")
      .notNull(),

    /**
     * Default feed visibility for newly created feed items.
     * Per-item audience rules can further refine this.
     */
    defaultFeedVisibilityMode: varchar("default_feed_visibility_mode", {
      length: 60,
    })
      .default("followers")
      .notNull(),

    /** Controls whether others can view follower count/list. */
    allowFollowerListVisibility: boolean("allow_follower_list_visibility")
      .default(true)
      .notNull(),

    /** Controls whether others can view following list. */
    allowFollowingListVisibility: boolean("allow_following_list_visibility")
      .default(true)
      .notNull(),

    /**
     * Optional convenience behavior:
     * if true, follows from identities in same biz context can auto-approve.
     */
    autoApproveSameBizFollow: boolean("auto_approve_same_biz_follow")
      .default(false)
      .notNull(),

    /** Extensible policy payload for future knobs. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One policy row per identity. */
    graphIdentityPoliciesIdentityUnique: uniqueIndex(
      "graph_identity_policies_identity_unique",
    ).on(table.identityId),

    graphIdentityPoliciesFollowModeCheck: check(
      "graph_identity_policies_follow_mode_check",
      sql`
      "follow_mode" IN ('open', 'approval_required', 'closed')
      OR "follow_mode" LIKE 'custom_%'
      `,
    ),

    graphIdentityPoliciesProfileVisibilityCheck: check(
      "graph_identity_policies_profile_visibility_check",
      sql`
      "profile_visibility_mode" IN ('public', 'followers', 'mutuals', 'private')
      OR "profile_visibility_mode" LIKE 'custom_%'
      `,
    ),

    graphIdentityPoliciesDefaultFeedVisibilityCheck: check(
      "graph_identity_policies_default_feed_visibility_check",
      sql`
      "default_feed_visibility_mode" IN ('public', 'followers', 'mutuals', 'private')
      OR "default_feed_visibility_mode" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * graph_relationships
 *
 * ELI5:
 * One row = one edge between two identities.
 *
 * Common examples:
 * - follow
 * - block
 * - mute
 *
 * Why generic:
 * - lets us reuse same backbone for future social/workflow relationships
 *   without adding new pairwise join tables.
 */
export const graphRelationships = pgTable(
  "graph_relationships",
  {
    /** Stable primary key. */
    id: idWithTag("graph_rel"),

    /** Source identity (the actor performing relationship action). */
    fromIdentityId: idRef("from_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /** Target identity (the identity being followed/blocked/etc.). */
    toIdentityId: idRef("to_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /**
     * Relationship type.
     * Keep as varchar + check so custom extensions can add `custom_*` types.
     */
    relationshipType: varchar("relationship_type", { length: 80 }).notNull(),

    /**
     * Relationship status.
     *
     * Typical follow lifecycle:
     * - pending  -> requested but waiting approval
     * - active   -> accepted/active
     * - rejected -> explicitly denied
     * - revoked  -> previously active but removed
     */
    status: varchar("status", { length: 40 }).default("active").notNull(),

    /** Optional effective-from timestamp for time-bound relationships. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional effective-to timestamp for expiring relationships. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** When the relationship action was requested/created. */
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Decision timestamp when moved out of pending. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    /** Optional identity that made final decision (for approval workflows). */
    decidedByIdentityId: idRef("decided_by_identity_id").references(
      () => graphIdentities.id,
    ),

    /** Extension payload (reason codes, workflow ids, moderation context). */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /**
     * One active logical edge per identity pair + relationship type.
     * Soft delete allows historical rows while preventing duplicate active edge.
     */
    graphRelationshipsActiveUnique: uniqueIndex("graph_relationships_active_unique")
      .on(table.fromIdentityId, table.toIdentityId, table.relationshipType)
      .where(sql`"deleted_at" IS NULL`),

    graphRelationshipsFromTypeStatusIdx: index(
      "graph_relationships_from_type_status_idx",
    ).on(table.fromIdentityId, table.relationshipType, table.status, table.requestedAt),

    graphRelationshipsToTypeStatusIdx: index(
      "graph_relationships_to_type_status_idx",
    ).on(table.toIdentityId, table.relationshipType, table.status, table.requestedAt),

    graphRelationshipsDeciderIdx: index("graph_relationships_decider_idx").on(
      table.decidedByIdentityId,
      table.status,
      table.decidedAt,
    ),

    /** Prevent self-edges for clearer semantics and query behavior. */
    graphRelationshipsNoSelfEdgeCheck: check(
      "graph_relationships_no_self_edge_check",
      sql`"from_identity_id" <> "to_identity_id"`,
    ),

    graphRelationshipsTypeCheck: check(
      "graph_relationships_type_check",
      sql`
      "relationship_type" IN ('follow', 'block', 'mute', 'friend', 'member', 'subscriber')
      OR "relationship_type" LIKE 'custom_%'
      `,
    ),

    graphRelationshipsStatusCheck: check(
      "graph_relationships_status_check",
      sql`
      "status" IN ('pending', 'active', 'rejected', 'revoked', 'blocked', 'muted')
      OR "status" LIKE 'custom_%'
      `,
    ),

    graphRelationshipsWindowCheck: check(
      "graph_relationships_window_check",
      sql`"effective_to" IS NULL OR "effective_to" > "effective_from"`,
    ),

    graphRelationshipsDecisionShapeCheck: check(
      "graph_relationships_decision_shape_check",
      sql`
      (
        "status" = 'pending'
        AND "decided_at" IS NULL
      ) OR (
        "status" <> 'pending'
      ) OR (
        "status" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * graph_relationship_events
 *
 * ELI5:
 * Immutable timeline of relationship lifecycle changes.
 *
 * Why this table exists:
 * - relationship row stores current state,
 * - this event table stores history ("how did we get here?"),
 * - plugins/workflows can subscribe to event rows without mutating edge state.
 */
export const graphRelationshipEvents = pgTable(
  "graph_relationship_events",
  {
    /** Stable primary key. */
    id: idWithTag("graph_rel_event"),

    /** Parent relationship edge this event belongs to. */
    relationshipId: idRef("relationship_id")
      .references(() => graphRelationships.id)
      .notNull(),

    /**
     * Event semantic class.
     * Keep extensible for future moderation/workflow states.
     */
    eventType: varchar("event_type", { length: 80 }).notNull(),

    /** Previous status snapshot when event was emitted. */
    fromStatus: varchar("from_status", { length: 40 }),

    /** New status snapshot when event was emitted. */
    toStatus: varchar("to_status", { length: 40 }),

    /** Optional actor identity who caused this transition. */
    actorIdentityId: idRef("actor_identity_id").references(() => graphIdentities.id),

    /** Business timestamp for when the event happened. */
    happenedAt: timestamp("happened_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional request/idempotency correlation key. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Optional reason code for analytics/debugging. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Non-indexed event payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphRelationshipEventsRelationshipHappenedIdx: index(
      "graph_relationship_events_relationship_happened_idx",
    ).on(table.relationshipId, table.happenedAt),

    graphRelationshipEventsTypeHappenedIdx: index(
      "graph_relationship_events_type_happened_idx",
    ).on(table.eventType, table.happenedAt),

    graphRelationshipEventsActorHappenedIdx: index(
      "graph_relationship_events_actor_happened_idx",
    ).on(table.actorIdentityId, table.happenedAt),

    graphRelationshipEventsRequestKeyUnique: uniqueIndex(
      "graph_relationship_events_request_key_unique",
    )
      .on(table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    graphRelationshipEventsTypeCheck: check(
      "graph_relationship_events_type_check",
      sql`
      "event_type" IN (
        'requested',
        'approved',
        'rejected',
        'revoked',
        'blocked',
        'unblocked',
        'muted',
        'unmuted',
        'status_changed'
      )
      OR "event_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * graph_audience_segments
 *
 * ELI5:
 * Named audience lists owned by one identity.
 *
 * Examples:
 * - "VIP followers"
 * - "Friends only"
 * - "Internal collaborators"
 *
 * Feed visibility rules can target segments to keep audience control simple and
 * reusable.
 */
export const graphAudienceSegments = pgTable(
  "graph_audience_segments",
  {
    /** Stable primary key. */
    id: idWithTag("graph_segment"),

    /** Identity that owns this segment/list. */
    ownerIdentityId: idRef("owner_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /** Human-readable segment name. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable machine slug unique within owner identity. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Segment lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Optional explanation for operators. */
    description: text("description"),

    /**
     * Dynamic segment marker.
     * - false: explicit membership rows
     * - true: computed from selector_definition
     */
    isDynamic: boolean("is_dynamic").default(false).notNull(),

    /**
     * Optional dynamic membership rules in JSON.
     * Application workers can evaluate and materialize rows as needed.
     */
    selectorDefinition: jsonb("selector_definition").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** One slug per owner identity. */
    graphAudienceSegmentsOwnerSlugUnique: uniqueIndex(
      "graph_audience_segments_owner_slug_unique",
    ).on(table.ownerIdentityId, table.slug),

    graphAudienceSegmentsOwnerStatusIdx: index(
      "graph_audience_segments_owner_status_idx",
    ).on(table.ownerIdentityId, table.status),
  }),
);

/**
 * graph_audience_segment_members
 *
 * ELI5:
 * Membership rows linking identities into audience segments.
 *
 * This table is reusable for:
 * - manual curation,
 * - import sync,
 * - dynamic rule materialization snapshots.
 */
export const graphAudienceSegmentMembers = pgTable(
  "graph_audience_segment_members",
  {
    /** Stable primary key. */
    id: idWithTag("graph_segment_member"),

    /** Parent segment. */
    segmentId: idRef("segment_id")
      .references(() => graphAudienceSegments.id)
      .notNull(),

    /** Identity included in that segment. */
    memberIdentityId: idRef("member_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /** Membership lifecycle state. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /**
     * Where this membership came from.
     * Keep flexible for connectors/plugins.
     */
    sourceType: varchar("source_type", { length: 60 }).default("manual").notNull(),

    /** Optional import/run/workflow correlation key. */
    sourceRef: varchar("source_ref", { length: 140 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Prevent duplicate active membership rows. */
    graphAudienceSegmentMembersActiveUnique: uniqueIndex(
      "graph_audience_segment_members_active_unique",
    )
      .on(table.segmentId, table.memberIdentityId)
      .where(sql`"deleted_at" IS NULL`),

    graphAudienceSegmentMembersSegmentStatusIdx: index(
      "graph_audience_segment_members_segment_status_idx",
    ).on(table.segmentId, table.status),

    graphAudienceSegmentMembersMemberStatusIdx: index(
      "graph_audience_segment_members_member_status_idx",
    ).on(table.memberIdentityId, table.status),

    graphAudienceSegmentMembersSourceTypeCheck: check(
      "graph_audience_segment_members_source_type_check",
      sql`
      "source_type" IN ('manual', 'rule', 'import', 'api')
      OR "source_type" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * graph_feed_items
 *
 * ELI5:
 * One row is one publishable item in an identity's feed.
 *
 * Can represent:
 * - manual posts
 * - offer launches/updates
 * - product announcements
 * - plugin/system events
 *
 * Visibility can be controlled by:
 * - default identity policy
 * - per-item audience rules
 */
export const graphFeedItems = pgTable(
  "graph_feed_items",
  {
    /** Stable primary key. */
    id: idWithTag("graph_feed_item"),

    /** Identity that owns/publishes this item. */
    ownerIdentityId: idRef("owner_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /**
     * Optional business context this item belongs to.
     * Useful for same-biz audience selectors and admin filtering.
     */
    contextBizId: idRef("context_biz_id").references(() => bizes.id),

    /** Item type key (post, launch, update, etc). */
    itemType: varchar("item_type", { length: 80 }).default("post").notNull(),

    /** Lifecycle status (draft/active/inactive/archived). */
    status: lifecycleStatusEnum("status").default("draft").notNull(),

    /**
     * Optional visibility mode override.
     * Null means "use owner's default policy".
     */
    visibilityMode: varchar("visibility_mode", { length: 60 }),

    /** Optional headline for list UIs. */
    title: varchar("title", { length: 255 }),

    /** Optional summary for preview cards. */
    summary: text("summary"),

    /** Optional long body text. */
    body: text("body"),

    /** Structured payload for plugins/channels/renderers. */
    payload: jsonb("payload").default({}).notNull(),

    /** Publish timestamp used for feed ordering. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /** Optional visibility start. */
    startsAt: timestamp("starts_at", { withTimezone: true }),

    /** Optional visibility end. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Pin flag for owner profile feed ordering. */
    isPinned: boolean("is_pinned").default(false).notNull(),

    /** Optional ranking score for blended ranking models. */
    rankScore: integer("rank_score").default(0).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphFeedItemsOwnerStatusPublishedIdx: index(
      "graph_feed_items_owner_status_published_idx",
    ).on(table.ownerIdentityId, table.status, table.publishedAt),

    graphFeedItemsContextBizStatusIdx: index(
      "graph_feed_items_context_biz_status_idx",
    ).on(table.contextBizId, table.status, table.publishedAt),

    graphFeedItemsTypeStatusIdx: index("graph_feed_items_type_status_idx").on(
      table.itemType,
      table.status,
      table.publishedAt,
    ),

    graphFeedItemsTypeCheck: check(
      "graph_feed_items_type_check",
      sql`
      "item_type" IN ('post', 'announcement', 'offer_launch', 'offer_update', 'product_launch', 'event')
      OR "item_type" LIKE 'custom_%'
      `,
    ),

    graphFeedItemsVisibilityModeCheck: check(
      "graph_feed_items_visibility_mode_check",
      sql`
      "visibility_mode" IS NULL
      OR "visibility_mode" IN ('public', 'followers', 'mutuals', 'private')
      OR "visibility_mode" LIKE 'custom_%'
      `,
    ),

    graphFeedItemsWindowCheck: check(
      "graph_feed_items_window_check",
      sql`
      ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
      AND "rank_score" >= 0
      `,
    ),
  }),
);

/**
 * graph_feed_item_links
 *
 * ELI5:
 * One feed item can reference many domain objects.
 *
 * Why this table exists:
 * - replaces single-link rigidity on feed items,
 * - lets one post link multiple targets (offer + product + event + docs),
 * - reuses the subject registry so plugin domains can participate immediately.
 */
export const graphFeedItemLinks = pgTable(
  "graph_feed_item_links",
  {
    /** Stable primary key. */
    id: idWithTag("graph_feed_link"),

    /** Parent feed item. */
    feedItemId: idRef("feed_item_id")
      .references(() => graphFeedItems.id)
      .notNull(),

    /**
     * Link role from feed item to subject.
     * Examples: primary, related, attachment, context.
     */
    linkType: varchar("link_type", { length: 60 }).default("related").notNull(),

    /** Ordered rendering hint (lower numbers render first). */
    sortOrder: integer("sort_order").default(100).notNull(),

    /** Target subject pointer. */
    subjectBizId: idRef("subject_biz_id").notNull(),
    subjectType: varchar("subject_type", { length: 80 }).notNull(),
    subjectId: varchar("subject_id", { length: 140 }).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphFeedItemLinksFeedSortIdx: index("graph_feed_item_links_feed_sort_idx").on(
      table.feedItemId,
      table.sortOrder,
    ),

    graphFeedItemLinksSubjectIdx: index("graph_feed_item_links_subject_idx").on(
      table.subjectBizId,
      table.subjectType,
      table.subjectId,
      table.linkType,
    ),

    /** Prevent duplicate active links for same feed item -> subject -> role. */
    graphFeedItemLinksUnique: uniqueIndex("graph_feed_item_links_unique")
      .on(table.feedItemId, table.subjectBizId, table.subjectType, table.subjectId, table.linkType)
      .where(sql`"deleted_at" IS NULL`),

    graphFeedItemLinksSubjectFk: foreignKey({
      columns: [table.subjectBizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "graph_feed_item_links_subject_fk",
    }),

    graphFeedItemLinksTypeCheck: check(
      "graph_feed_item_links_type_check",
      sql`
      "link_type" IN ('primary', 'related', 'attachment', 'context')
      OR "link_type" LIKE 'custom_%'
      `,
    ),

    graphFeedItemLinksSortCheck: check(
      "graph_feed_item_links_sort_check",
      sql`"sort_order" >= 0`,
    ),
  }),
);

/**
 * graph_feed_item_deliveries
 *
 * ELI5:
 * Per-viewer read/delivery state for feed items.
 *
 * Why this table exists:
 * - supports inbox/feed read models and personalization,
 * - keeps visibility evaluation outcomes auditable,
 * - enables notification dedupe and engagement analytics.
 */
export const graphFeedItemDeliveries = pgTable(
  "graph_feed_item_deliveries",
  {
    /** Stable primary key. */
    id: idWithTag("graph_feed_delivery"),

    /** Feed item being delivered/evaluated. */
    feedItemId: idRef("feed_item_id")
      .references(() => graphFeedItems.id)
      .notNull(),

    /** Viewer identity this row is about. */
    viewerIdentityId: idRef("viewer_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /**
     * Delivery/read state lifecycle.
     * - eligible: viewer qualifies, not yet delivered
     * - delivered: surfaced/sent
     * - seen: viewer viewed item
     * - dismissed: viewer dismissed item
     * - hidden: suppressed by user/system rule
     * - suppressed: filtered by policy/rule
     */
    status: varchar("status", { length: 40 }).default("eligible").notNull(),

    /** Optional reason code for suppression/filtering/explanation. */
    reasonCode: varchar("reason_code", { length: 120 }),

    /** Rank score snapshot used when delivered. */
    rankScore: integer("rank_score"),

    /** First delivery timestamp. */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    /** First seen timestamp. */
    seenAt: timestamp("seen_at", { withTimezone: true }),

    /** Dismissal timestamp. */
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),

    /** Hidden/suppressed timestamp. */
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphFeedItemDeliveriesUnique: uniqueIndex("graph_feed_item_deliveries_unique").on(
      table.feedItemId,
      table.viewerIdentityId,
    ),

    graphFeedItemDeliveriesViewerStatusIdx: index(
      "graph_feed_item_deliveries_viewer_status_idx",
    ).on(table.viewerIdentityId, table.status, table.deliveredAt),

    graphFeedItemDeliveriesFeedStatusIdx: index(
      "graph_feed_item_deliveries_feed_status_idx",
    ).on(table.feedItemId, table.status, table.deliveredAt),

    graphFeedItemDeliveriesStatusCheck: check(
      "graph_feed_item_deliveries_status_check",
      sql`
      "status" IN ('eligible', 'delivered', 'seen', 'dismissed', 'hidden', 'suppressed')
      OR "status" LIKE 'custom_%'
      `,
    ),
  }),
);

/**
 * graph_subject_subscriptions
 *
 * ELI5:
 * Lets identities subscribe/watch arbitrary subjects (offers, products,
 * resources, custom plugin entities), not only other identities.
 *
 * This opens new product possibilities:
 * - "Notify me when this offer has slots"
 * - "Watch this venue/asset"
 * - "Follow this product updates stream"
 */
export const graphSubjectSubscriptions = pgTable(
  "graph_subject_subscriptions",
  {
    /** Stable primary key. */
    id: idWithTag("graph_subject_sub"),

    /** Identity that subscribes. */
    subscriberIdentityId: idRef("subscriber_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /** Target subject being followed/watched. */
    targetSubjectBizId: idRef("target_subject_biz_id").notNull(),
    targetSubjectType: varchar("target_subject_type", { length: 80 }).notNull(),
    targetSubjectId: varchar("target_subject_id", { length: 140 }).notNull(),

    /**
     * Subscription mode.
     * Examples: watch, follow, favorite, notify.
     */
    subscriptionType: varchar("subscription_type", { length: 60 })
      .default("watch")
      .notNull(),

    /** Subscription lifecycle status. */
    status: varchar("status", { length: 40 }).default("active").notNull(),

    /** Optional rule/filters for when notifications should trigger. */
    filterPolicy: jsonb("filter_policy").default({}).notNull(),

    /**
     * Delivery cadence preference.
     * - off: never send deliveries for this subscription
     * - instant: deliver near real-time
     * - digest: bundle into periodic deliveries
     */
    deliveryMode: varchar("delivery_mode", { length: 40 })
      .default("instant")
      .notNull(),

    /**
     * Preferred delivery channel.
     * `in_app` is default and does not require external endpoint metadata.
     */
    preferredChannel: varchar("preferred_channel", { length: 40 })
      .default("in_app")
      .notNull(),

    /**
     * Cooldown window between deliveries to avoid spamming.
     * 0 means "no cooldown".
     */
    minDeliveryIntervalMinutes: integer("min_delivery_interval_minutes")
      .default(0)
      .notNull(),

    /**
     * Optional scheduler hint for when next delivery is allowed.
     * Worker pipelines can update this after delivery attempts.
     */
    nextEligibleDeliveryAt: timestamp("next_eligible_delivery_at", {
      withTimezone: true,
    }),

    /** Optional muting timestamp. */
    mutedAt: timestamp("muted_at", { withTimezone: true }),

    /** Optional unsubscription timestamp. */
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphSubjectSubscriptionsUnique: uniqueIndex("graph_subject_subscriptions_unique")
      .on(
        table.subscriberIdentityId,
        table.targetSubjectBizId,
        table.targetSubjectType,
        table.targetSubjectId,
        table.subscriptionType,
      )
      .where(sql`"deleted_at" IS NULL`),

    graphSubjectSubscriptionsSubscriberStatusIdx: index(
      "graph_subject_subscriptions_subscriber_status_idx",
    ).on(table.subscriberIdentityId, table.status, table.subscriptionType),

    graphSubjectSubscriptionsTargetStatusIdx: index(
      "graph_subject_subscriptions_target_status_idx",
    ).on(
      table.targetSubjectBizId,
      table.targetSubjectType,
      table.targetSubjectId,
      table.status,
    ),

    graphSubjectSubscriptionsTargetSubjectFk: foreignKey({
      columns: [table.targetSubjectBizId, table.targetSubjectType, table.targetSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "graph_subject_subscriptions_target_subject_fk",
    }),

    graphSubjectSubscriptionsTypeCheck: check(
      "graph_subject_subscriptions_type_check",
      sql`
      "subscription_type" IN ('watch', 'follow', 'favorite', 'notify')
      OR "subscription_type" LIKE 'custom_%'
      `,
    ),

    graphSubjectSubscriptionsStatusCheck: check(
      "graph_subject_subscriptions_status_check",
      sql`
      "status" IN ('active', 'muted', 'unsubscribed')
      OR "status" LIKE 'custom_%'
      `,
    ),

    graphSubjectSubscriptionsDeliveryModeCheck: check(
      "graph_subject_subscriptions_delivery_mode_check",
      sql`
      "delivery_mode" IN ('off', 'instant', 'digest')
      OR "delivery_mode" LIKE 'custom_%'
      `,
    ),

    graphSubjectSubscriptionsPreferredChannelCheck: check(
      "graph_subject_subscriptions_preferred_channel_check",
      sql`
      "preferred_channel" IN ('in_app', 'email', 'sms', 'push', 'webhook')
      OR "preferred_channel" LIKE 'custom_%'
      `,
    ),

    graphSubjectSubscriptionsDeliveryBoundsCheck: check(
      "graph_subject_subscriptions_delivery_bounds_check",
      sql`"min_delivery_interval_minutes" >= 0`,
    ),
  }),
);

/**
 * graph_identity_notification_endpoints
 *
 * ELI5:
 * Contact endpoints where one identity can receive notifications.
 *
 * Examples:
 * - in-app inbox (no destination needed),
 * - email address,
 * - sms number,
 * - push token reference,
 * - webhook target.
 *
 * Why this table exists:
 * - subscription rows can stay channel-agnostic,
 * - delivery workers can route to one verified endpoint record,
 * - integrations can plug new endpoint types via `custom_%` channels.
 */
export const graphIdentityNotificationEndpoints = pgTable(
  "graph_identity_notification_endpoints",
  {
    /** Stable primary key. */
    id: idWithTag("graph_notif_endpoint"),

    /** Identity that owns this endpoint. */
    ownerIdentityId: idRef("owner_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /**
     * Optional biz context for endpoint governance.
     * Null means endpoint is global to identity across bizes.
     */
    bizId: idRef("biz_id").references(() => bizes.id),

    /** Endpoint channel class. */
    channel: varchar("channel", { length: 40 }).default("in_app").notNull(),

    /**
     * Destination payload (email, phone, token ref, webhook url/ref).
     * Null is valid for `in_app`.
     */
    destination: varchar("destination", { length: 500 }),

    /** Lifecycle state using shared enum for consistency. */
    status: lifecycleStatusEnum("status").default("active").notNull(),

    /** Default endpoint marker within owner + channel. */
    isDefault: boolean("is_default").default(false).notNull(),

    /** Verification timestamp for channels that need verification. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    /** Last successful use timestamp. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphIdentityNotificationEndpointsBizIdIdUnique: uniqueIndex("graph_identity_notification_endpoints_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for owner-safe delivery foreign keys. */
    graphIdentityNotificationEndpointsOwnerIdUnique: uniqueIndex(
      "graph_identity_notification_endpoints_owner_id_unique",
    ).on(table.ownerIdentityId, table.id),

    /** Avoid duplicate active destination rows for same channel. */
    graphIdentityNotificationEndpointsDestinationUnique: uniqueIndex(
      "graph_identity_notification_endpoints_destination_unique",
    )
      .on(table.ownerIdentityId, table.channel, table.destination)
      .where(sql`"deleted_at" IS NULL AND "destination" IS NOT NULL`),

    /** Keep one default endpoint per owner/channel. */
    graphIdentityNotificationEndpointsDefaultUnique: uniqueIndex(
      "graph_identity_notification_endpoints_default_unique",
    )
      .on(table.ownerIdentityId, table.channel)
      .where(sql`"is_default" = true AND "deleted_at" IS NULL`),

    graphIdentityNotificationEndpointsOwnerStatusIdx: index(
      "graph_identity_notification_endpoints_owner_status_idx",
    ).on(table.ownerIdentityId, table.status, table.channel),

    graphIdentityNotificationEndpointsBizStatusIdx: index(
      "graph_identity_notification_endpoints_biz_status_idx",
    ).on(table.bizId, table.status, table.channel),

    graphIdentityNotificationEndpointsChannelCheck: check(
      "graph_identity_notification_endpoints_channel_check",
      sql`
      "channel" IN ('in_app', 'email', 'sms', 'push', 'webhook')
      OR "channel" LIKE 'custom_%'
      `,
    ),

    graphIdentityNotificationEndpointsDestinationShapeCheck: check(
      "graph_identity_notification_endpoints_destination_shape_check",
      sql`
      (
        "channel" = 'in_app'
        AND "destination" IS NULL
      ) OR (
        "channel" <> 'in_app'
        AND "destination" IS NOT NULL
      ) OR (
        "channel" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * graph_subject_events
 *
 * ELI5:
 * Immutable event stream for arbitrary subjects.
 *
 * This lets any domain publish changes that subscribers care about, such as:
 * - offer slots opened,
 * - product restock,
 * - resource status change,
 * - plugin-defined custom events.
 */
export const graphSubjectEvents = pgTable(
  "graph_subject_events",
  {
    /** Stable primary key. */
    id: idWithTag("graph_subject_event"),

    /** Tenant boundary for event routing and filtering. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Subject that emitted this event. */
    subjectType: varchar("subject_type", { length: 80 }).notNull(),
    subjectId: varchar("subject_id", { length: 140 }).notNull(),

    /** Event type key. */
    eventType: varchar("event_type", { length: 100 }).notNull(),

    /** Optional actor identity responsible for the event. */
    actorIdentityId: idRef("actor_identity_id").references(() => graphIdentities.id),

    /** Event timestamp. */
    happenedAt: timestamp("happened_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Priority hint for delivery pipelines (higher first). */
    priority: integer("priority").default(100).notNull(),

    /** Optional idempotency key for producer safety. */
    requestKey: varchar("request_key", { length: 140 }),

    /** Optional cross-service correlation key. */
    correlationKey: varchar("correlation_key", { length: 200 }),

    /** Event payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphSubjectEventsBizIdIdUnique: uniqueIndex("graph_subject_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite key for tenant-safe event delivery FKs. */

    graphSubjectEventsSubjectHappenedIdx: index(
      "graph_subject_events_subject_happened_idx",
    ).on(table.bizId, table.subjectType, table.subjectId, table.happenedAt),

    graphSubjectEventsTypeHappenedIdx: index(
      "graph_subject_events_type_happened_idx",
    ).on(table.bizId, table.eventType, table.happenedAt),

    graphSubjectEventsActorHappenedIdx: index(
      "graph_subject_events_actor_happened_idx",
    ).on(table.actorIdentityId, table.happenedAt),

    graphSubjectEventsRequestKeyUnique: uniqueIndex(
      "graph_subject_events_request_key_unique",
    )
      .on(table.bizId, table.requestKey)
      .where(sql`"request_key" IS NOT NULL`),

    graphSubjectEventsSubjectFk: foreignKey({
      columns: [table.bizId, table.subjectType, table.subjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "graph_subject_events_subject_fk",
    }),

    graphSubjectEventsTypeCheck: check(
      "graph_subject_events_type_check",
      sql`length("event_type") > 0`,
    ),

    graphSubjectEventsPriorityCheck: check(
      "graph_subject_events_priority_check",
      sql`"priority" >= 0`,
    ),
  }),
);

/**
 * graph_subject_event_deliveries
 *
 * ELI5:
 * One row tracks delivery state of one subject event to one subscription+channel.
 *
 * This enables:
 * - retries/backoff,
 * - dedupe,
 * - read/seen state,
 * - analytics on notification effectiveness.
 */
export const graphSubjectEventDeliveries = pgTable(
  "graph_subject_event_deliveries",
  {
    /** Stable primary key. */
    id: idWithTag("graph_subject_delivery"),

    /** Tenant boundary mirrors parent event. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Source event being delivered. */
    subjectEventId: idRef("subject_event_id")
      .references(() => graphSubjectEvents.id)
      .notNull(),

    /** Subscription that triggered this delivery candidate. */
    subscriptionId: idRef("subscription_id")
      .references(() => graphSubjectSubscriptions.id)
      .notNull(),

    /** Subscriber identity (denormalized for fast reads). */
    subscriberIdentityId: idRef("subscriber_identity_id")
      .references(() => graphIdentities.id)
      .notNull(),

    /**
     * Optional concrete endpoint selected for delivery.
     * Null is allowed for `in_app` channel.
     */
    endpointId: idRef("endpoint_id").references(() => graphIdentityNotificationEndpoints.id),

    /** Delivery channel used for this row. */
    channel: varchar("channel", { length: 40 }).default("in_app").notNull(),

    /**
     * Delivery state.
     * Uses `state` (not `status`) to avoid lifecycle enum coupling with other domains.
     */
    state: varchar("state", { length: 40 }).default("queued").notNull(),

    /** Queue timestamp. */
    queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),

    /** Last attempt timestamp. */
    attemptedAt: timestamp("attempted_at", { withTimezone: true }),

    /** Delivery success timestamp. */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    /** Seen/read timestamp where applicable. */
    seenAt: timestamp("seen_at", { withTimezone: true }),

    /** Failure timestamp if last attempt failed. */
    failedAt: timestamp("failed_at", { withTimezone: true }),

    /** Number of delivery attempts so far. */
    attemptCount: integer("attempt_count").default(0).notNull(),

    /** Optional failure summary from provider/channel worker. */
    failureReason: varchar("failure_reason", { length: 1000 }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphSubjectEventDeliveriesBizIdIdUnique: uniqueIndex("graph_subject_event_deliveries_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Dedupe key for one event+subscription+channel route. */
    graphSubjectEventDeliveriesUnique: uniqueIndex(
      "graph_subject_event_deliveries_unique",
    ).on(table.subjectEventId, table.subscriptionId, table.channel),

    graphSubjectEventDeliveriesSubscriberStateIdx: index(
      "graph_subject_event_deliveries_subscriber_state_idx",
    ).on(table.subscriberIdentityId, table.state, table.queuedAt),

    graphSubjectEventDeliveriesEventStateIdx: index(
      "graph_subject_event_deliveries_event_state_idx",
    ).on(table.subjectEventId, table.state, table.queuedAt),

    graphSubjectEventDeliveriesChannelStateIdx: index(
      "graph_subject_event_deliveries_channel_state_idx",
    ).on(table.channel, table.state, table.queuedAt),

    /** Ensures event reference stays in same tenant scope. */
    graphSubjectEventDeliveriesBizEventFk: foreignKey({
      columns: [table.bizId, table.subjectEventId],
      foreignColumns: [graphSubjectEvents.bizId, graphSubjectEvents.id],
      name: "graph_subject_event_deliveries_biz_event_fk",
    }),

    /** Ensures endpoint owner matches subscriber identity when endpoint is set. */
    graphSubjectEventDeliveriesSubscriberEndpointFk: foreignKey({
      columns: [table.subscriberIdentityId, table.endpointId],
      foreignColumns: [graphIdentityNotificationEndpoints.ownerIdentityId, graphIdentityNotificationEndpoints.id],
      name: "graph_subject_event_deliveries_subscriber_endpoint_fk",
    }),

    graphSubjectEventDeliveriesChannelCheck: check(
      "graph_subject_event_deliveries_channel_check",
      sql`
      "channel" IN ('in_app', 'email', 'sms', 'push', 'webhook')
      OR "channel" LIKE 'custom_%'
      `,
    ),

    graphSubjectEventDeliveriesStateCheck: check(
      "graph_subject_event_deliveries_state_check",
      sql`
      "state" IN ('queued', 'retry_scheduled', 'sent', 'seen', 'dismissed', 'failed', 'suppressed')
      OR "state" LIKE 'custom_%'
      `,
    ),

    graphSubjectEventDeliveriesAttemptCountCheck: check(
      "graph_subject_event_deliveries_attempt_count_check",
      sql`"attempt_count" >= 0`,
    ),

    graphSubjectEventDeliveriesEndpointShapeCheck: check(
      "graph_subject_event_deliveries_endpoint_shape_check",
      sql`
      (
        "channel" = 'in_app'
        AND "endpoint_id" IS NULL
      ) OR (
        "channel" <> 'in_app'
        AND "endpoint_id" IS NOT NULL
      ) OR (
        "channel" LIKE 'custom_%'
      )
      `,
    ),
  }),
);

/**
 * graph_feed_item_audience_rules
 *
 * ELI5:
 * These are allow/deny audience filters for a specific feed item.
 *
 * Rule evaluation idea:
 * - collect candidate viewers
 * - apply all matching allow rules
 * - apply all matching deny rules (deny wins)
 * - use priority/effective window for deterministic behavior
 *
 * Selector types:
 * - public
 * - followers
 * - mutuals
 * - identity
 * - relationship_type
 * - segment
 * - same_biz
 * - custom_subject
 */
export const graphFeedItemAudienceRules = pgTable(
  "graph_feed_item_audience_rules",
  {
    /** Stable primary key. */
    id: idWithTag("graph_audience_rule"),

    /** Target feed item this rule applies to. */
    feedItemId: idRef("feed_item_id")
      .references(() => graphFeedItems.id)
      .notNull(),

    /** Rule effect. */
    effect: varchar("effect", { length: 20 }).default("allow").notNull(),

    /** Audience selector type for this rule. */
    selectorType: varchar("selector_type", { length: 80 }).notNull(),

    /** Selector payload for selector_type='identity'. */
    selectorIdentityId: idRef("selector_identity_id").references(
      () => graphIdentities.id,
    ),

    /** Selector payload for selector_type='relationship_type'. */
    selectorRelationshipType: varchar("selector_relationship_type", {
      length: 80,
    }),

    /** Selector payload for selector_type='segment'. */
    selectorSegmentId: idRef("selector_segment_id").references(
      () => graphAudienceSegments.id,
    ),

    /** Selector payload for selector_type='custom_subject'. */
    selectorSubjectBizId: idRef("selector_subject_biz_id"),
    selectorSubjectType: varchar("selector_subject_type", { length: 80 }),
    selectorSubjectId: varchar("selector_subject_id", { length: 140 }),

    /** Priority for deterministic rule ordering (higher wins). */
    priority: integer("priority").default(100).notNull(),

    /** Optional effective start. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** Optional effective end. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    graphFeedItemAudienceRulesFeedPriorityIdx: index(
      "graph_feed_item_audience_rules_feed_priority_idx",
    ).on(table.feedItemId, table.priority, table.effectiveFrom),

    graphFeedItemAudienceRulesSelectorIdentityIdx: index(
      "graph_feed_item_audience_rules_selector_identity_idx",
    ).on(table.selectorIdentityId, table.selectorType, table.effect),

    graphFeedItemAudienceRulesSelectorSegmentIdx: index(
      "graph_feed_item_audience_rules_selector_segment_idx",
    ).on(table.selectorSegmentId, table.selectorType, table.effect),

    /** Tenant-safe FK for optional custom-subject selector payload. */
    graphFeedItemAudienceRulesSelectorSubjectFk: foreignKey({
      columns: [table.selectorSubjectBizId, table.selectorSubjectType, table.selectorSubjectId],
      foreignColumns: [subjects.bizId, subjects.subjectType, subjects.subjectId],
      name: "graph_feed_item_audience_rules_selector_subject_fk",
    }),

    graphFeedItemAudienceRulesEffectCheck: check(
      "graph_feed_item_audience_rules_effect_check",
      sql`
      "effect" IN ('allow', 'deny')
      OR "effect" LIKE 'custom_%'
      `,
    ),

    graphFeedItemAudienceRulesSelectorTypeCheck: check(
      "graph_feed_item_audience_rules_selector_type_check",
      sql`
      "selector_type" IN (
        'public',
        'followers',
        'mutuals',
        'identity',
        'relationship_type',
        'segment',
        'same_biz',
        'custom_subject'
      )
      OR "selector_type" LIKE 'custom_%'
      `,
    ),

    /**
     * Enforce exact selector payload shape for deterministic interpretation.
     */
    graphFeedItemAudienceRulesSelectorShapeCheck: check(
      "graph_feed_item_audience_rules_selector_shape_check",
      sql`
      (
        "selector_type" IN ('public', 'followers', 'mutuals', 'same_biz')
        AND "selector_identity_id" IS NULL
        AND "selector_relationship_type" IS NULL
        AND "selector_segment_id" IS NULL
        AND "selector_subject_biz_id" IS NULL
        AND "selector_subject_type" IS NULL
        AND "selector_subject_id" IS NULL
      ) OR (
        "selector_type" = 'identity'
        AND "selector_identity_id" IS NOT NULL
        AND "selector_relationship_type" IS NULL
        AND "selector_segment_id" IS NULL
        AND "selector_subject_biz_id" IS NULL
        AND "selector_subject_type" IS NULL
        AND "selector_subject_id" IS NULL
      ) OR (
        "selector_type" = 'relationship_type'
        AND "selector_identity_id" IS NULL
        AND "selector_relationship_type" IS NOT NULL
        AND "selector_segment_id" IS NULL
        AND "selector_subject_biz_id" IS NULL
        AND "selector_subject_type" IS NULL
        AND "selector_subject_id" IS NULL
      ) OR (
        "selector_type" = 'segment'
        AND "selector_identity_id" IS NULL
        AND "selector_relationship_type" IS NULL
        AND "selector_segment_id" IS NOT NULL
        AND "selector_subject_biz_id" IS NULL
        AND "selector_subject_type" IS NULL
        AND "selector_subject_id" IS NULL
      ) OR (
        "selector_type" = 'custom_subject'
        AND "selector_identity_id" IS NULL
        AND "selector_relationship_type" IS NULL
        AND "selector_segment_id" IS NULL
        AND "selector_subject_biz_id" IS NOT NULL
        AND "selector_subject_type" IS NOT NULL
        AND "selector_subject_id" IS NOT NULL
      ) OR (
        "selector_type" LIKE 'custom_%'
      )
      `,
    ),

    graphFeedItemAudienceRulesWindowCheck: check(
      "graph_feed_item_audience_rules_window_check",
      sql`
      "priority" >= 0
      AND ("effective_to" IS NULL OR "effective_to" > "effective_from")
      `,
    ),
  }),
);

export type GraphIdentity = typeof graphIdentities.$inferSelect;
export type NewGraphIdentity = typeof graphIdentities.$inferInsert;

export type GraphIdentityPolicy = typeof graphIdentityPolicies.$inferSelect;
export type NewGraphIdentityPolicy = typeof graphIdentityPolicies.$inferInsert;

export type GraphRelationship = typeof graphRelationships.$inferSelect;
export type NewGraphRelationship = typeof graphRelationships.$inferInsert;

export type GraphRelationshipEvent = typeof graphRelationshipEvents.$inferSelect;
export type NewGraphRelationshipEvent = typeof graphRelationshipEvents.$inferInsert;

export type GraphAudienceSegment = typeof graphAudienceSegments.$inferSelect;
export type NewGraphAudienceSegment = typeof graphAudienceSegments.$inferInsert;

export type GraphAudienceSegmentMember =
  typeof graphAudienceSegmentMembers.$inferSelect;
export type NewGraphAudienceSegmentMember =
  typeof graphAudienceSegmentMembers.$inferInsert;

export type GraphFeedItem = typeof graphFeedItems.$inferSelect;
export type NewGraphFeedItem = typeof graphFeedItems.$inferInsert;

export type GraphFeedItemLink = typeof graphFeedItemLinks.$inferSelect;
export type NewGraphFeedItemLink = typeof graphFeedItemLinks.$inferInsert;

export type GraphFeedItemDelivery = typeof graphFeedItemDeliveries.$inferSelect;
export type NewGraphFeedItemDelivery = typeof graphFeedItemDeliveries.$inferInsert;

export type GraphSubjectSubscription = typeof graphSubjectSubscriptions.$inferSelect;
export type NewGraphSubjectSubscription =
  typeof graphSubjectSubscriptions.$inferInsert;

export type GraphIdentityNotificationEndpoint =
  typeof graphIdentityNotificationEndpoints.$inferSelect;
export type NewGraphIdentityNotificationEndpoint =
  typeof graphIdentityNotificationEndpoints.$inferInsert;

export type GraphSubjectEvent = typeof graphSubjectEvents.$inferSelect;
export type NewGraphSubjectEvent = typeof graphSubjectEvents.$inferInsert;

export type GraphSubjectEventDelivery =
  typeof graphSubjectEventDeliveries.$inferSelect;
export type NewGraphSubjectEventDelivery =
  typeof graphSubjectEventDeliveries.$inferInsert;

export type GraphFeedItemAudienceRule = typeof graphFeedItemAudienceRules.$inferSelect;
export type NewGraphFeedItemAudienceRule = typeof graphFeedItemAudienceRules.$inferInsert;
