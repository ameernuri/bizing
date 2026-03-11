import 'dotenv/config'
import { normalizeSagaSpec, type SagaDepth, type SagaSpec } from '../sagas/spec-schema.js'
import {
  syncSagaDefinitions,
  upsertSagaDefinitionSpec,
} from '../services/sagas.js'

type Theme = {
  id: number
  slug: string
  title: string
  risk: string
  holeHypothesis: string
  routeAreas: string[]
  endpointExamples: string[]
}

type CliOptions = {
  sync: boolean
  overwrite: boolean
}

const THEMES: Theme[] = [
  {
    id: 1,
    slug: 'auth-machine-tokens',
    title: 'Machine Auth And Token Lifecycle',
    risk: 'Machine credentials drift from session auth behavior and break critical automation paths.',
    holeHypothesis:
      'API key exchange, rotation, and revoke can diverge under mixed auth paths and leave stale access.',
    routeAreas: ['auth-machine', 'authz', 'governance'],
    endpointExamples: ['/api/v1/auth/api-keys', '/api/v1/auth/tokens/exchange'],
  },
  {
    id: 2,
    slug: 'acl-tenant-boundaries',
    title: 'Tenant Boundary ACL Enforcement',
    risk: 'Cross-biz reads/writes leak data or mutate the wrong scope when actor context is ambiguous.',
    holeHypothesis:
      'Route guard and ACL policy checks may pass independently but fail together in edge scope permutations.',
    routeAreas: ['authz', 'bizes', 'access'],
    endpointExamples: ['/api/v1/bizes', '/api/v1/bizes/:bizId/members'],
  },
  {
    id: 3,
    slug: 'actions-idempotency',
    title: 'Action Idempotency And Replay Safety',
    risk: 'Duplicate action execution causes inconsistent state and non-reconcilable audit history.',
    holeHypothesis:
      'Action request keys can collide or be ignored in certain route adapters under retries.',
    routeAreas: ['actions', 'extensions', 'ooda'],
    endpointExamples: ['/api/v1/bizes/:bizId/actions/execute', '/api/v1/bizes/:bizId/actions/preview'],
  },
  {
    id: 4,
    slug: 'bookings-overlap-and-holds',
    title: 'Booking Overlap And Hold Contention',
    risk: 'Concurrent booking and hold behavior can over-allocate capacity under race conditions.',
    holeHypothesis:
      'Hold and overlap checks may validate separately yet fail when requests arrive near-simultaneously.',
    routeAreas: ['bookings', 'calendars', 'queues'],
    endpointExamples: ['/api/v1/public/bizes/:bizId/booking-orders', '/api/v1/bizes/:bizId/calendars/:calendarId/capacity-holds'],
  },
  {
    id: 5,
    slug: 'calendar-sharing-privacy',
    title: 'Calendar Sharing Privacy Controls',
    risk: 'Shared calendar views expose availability details beyond configured visibility policies.',
    holeHypothesis:
      'Share-level policy and actor-level permission can disagree when external calendars are attached.',
    routeAreas: ['calendar-sharing', 'calendars', 'resources'],
    endpointExamples: ['/api/v1/bizes/:bizId/calendar-shares', '/api/v1/bizes/:bizId/calendars/:calendarId/timeline'],
  },
  {
    id: 6,
    slug: 'availability-time-scope-consistency',
    title: 'Availability Time Scope Consistency',
    risk: 'Availability and hold objects lose normalized scope linkage and produce incorrect timelines.',
    holeHypothesis:
      'Legacy records without time_scope_id create runtime drift and false negatives in scheduling logic.',
    routeAreas: ['calendars', 'operations', 'sagas'],
    endpointExamples: ['/api/v1/bizes/:bizId/calendars/:calendarId/availability-rules', '/api/v1/bizes/:bizId/calendars/:calendarId/capacity-holds'],
  },
  {
    id: 7,
    slug: 'demand-pricing-manual-auto',
    title: 'Demand Pricing Manual Plus Policy Interplay',
    risk: 'Manual override and automated demand policy interactions produce unstable final pricing.',
    holeHypothesis:
      'Policy precedence is not consistently enforced across quote, offer, and checkout surfaces.',
    routeAreas: ['demand-pricing', 'sellable-pricing', 'offers'],
    endpointExamples: ['/api/v1/bizes/:bizId/demand-pricing/policies', '/api/v1/bizes/:bizId/sellable-pricing-overrides'],
  },
  {
    id: 8,
    slug: 'payments-split-and-refunds',
    title: 'Split Tender And Refund Traceability',
    risk: 'Payment allocations drift from booking/order lines and break true revenue attribution.',
    holeHypothesis:
      'Partial capture/refund with mixed tenders can leave inconsistent per-line allocations.',
    routeAreas: ['payments', 'bookings', 'reporting'],
    endpointExamples: ['/api/v1/bizes/:bizId/payments/payment-intents', '/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/line-execution'],
  },
  {
    id: 9,
    slug: 'stripe-webhook-reconciliation',
    title: 'Stripe Webhook Reconciliation',
    risk: 'Asynchronous payment updates are processed out-of-order and create duplicate lifecycle transitions.',
    holeHypothesis:
      'Webhook idempotency and internal action dedupe are not perfectly aligned.',
    routeAreas: ['payments', 'webhooks', 'actions'],
    endpointExamples: ['/api/v1/payments/stripe/webhook', '/api/v1/bizes/:bizId/payments/transactions'],
  },
  {
    id: 10,
    slug: 'receivables-settlement-ledger',
    title: 'Receivables Settlement Ledger Consistency',
    risk: 'Receivable state and settlement entries diverge under retries and delayed payments.',
    holeHypothesis:
      'Receivables aging and settlement rollups can disagree after asynchronous corrections.',
    routeAreas: ['receivables', 'payments', 'reporting'],
    endpointExamples: ['/api/v1/bizes/:bizId/receivables', '/api/v1/bizes/:bizId/payout-ledger-entries'],
  },
  {
    id: 11,
    slug: 'checkout-recovery-expiry',
    title: 'Checkout Recovery And Expiry Safety',
    risk: 'Expired or replayed recovery links can revive invalid sessions and mutate stale carts.',
    holeHypothesis:
      'Recovery token lifecycle and checkout state TTL are not fully synchronized.',
    routeAreas: ['checkout', 'payments', 'communications'],
    endpointExamples: ['/api/v1/bizes/:bizId/checkout-sessions/:checkoutSessionId/recovery-links', '/api/v1/bizes/:bizId/checkout-sessions/:checkoutSessionId/events'],
  },
  {
    id: 12,
    slug: 'offers-versioning-publish',
    title: 'Offer Versioning Publish Consistency',
    risk: 'Published offer version, pricing, and availability pointers drift under concurrent edits.',
    holeHypothesis:
      'Offer shell and active version updates race and expose partially published catalogs.',
    routeAreas: ['offers', 'service-products', 'reporting'],
    endpointExamples: ['/api/v1/bizes/:bizId/offers', '/api/v1/bizes/:bizId/offers/:offerId/versions'],
  },
  {
    id: 13,
    slug: 'service-product-requirements',
    title: 'Service Product Requirement Resolution',
    risk: 'Requirement selectors resolve ambiguous resources and allow invalid booking combinations.',
    holeHypothesis:
      'Selector type and payload constraints can be valid individually but invalid as a set.',
    routeAreas: ['service-product-requirements', 'service-products', 'resources'],
    endpointExamples: ['/api/v1/bizes/:bizId/service-product-requirements', '/api/v1/bizes/:bizId/service-products'],
  },
  {
    id: 14,
    slug: 'resources-capacity-lifecycle',
    title: 'Resource Capacity Lifecycle',
    risk: 'Resource status, capacity, and scheduling bindings drift and break availability truth.',
    holeHypothesis:
      'Resource updates do not always propagate to related schedule/booking constraints.',
    routeAreas: ['resources', 'calendars', 'supply'],
    endpointExamples: ['/api/v1/bizes/:bizId/resources', '/api/v1/bizes/:bizId/resources/:resourceId'],
  },
  {
    id: 15,
    slug: 'fulfillment-state-handshake',
    title: 'Fulfillment State Handshake',
    risk: 'Booking and fulfillment state machines diverge, causing operational confusion and bad reporting.',
    holeHypothesis:
      'State transitions are allowed in one surface and rejected in another for the same lifecycle event.',
    routeAreas: ['fulfillment', 'bookings', 'operations'],
    endpointExamples: ['/api/v1/bizes/:bizId/fulfillment-units', '/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/line-execution'],
  },
  {
    id: 16,
    slug: 'dispatch-routing-reassignment',
    title: 'Dispatch Routing Reassignment',
    risk: 'Reassignment under active work causes ownership ambiguity and missed SLA windows.',
    holeHypothesis:
      'Dispatch reassignment may skip policy checks during high-frequency updates.',
    routeAreas: ['dispatch', 'work-management', 'staffing'],
    endpointExamples: ['/api/v1/bizes/:bizId/dispatch-jobs', '/api/v1/bizes/:bizId/dispatch-routes'],
  },
  {
    id: 17,
    slug: 'queue-counter-service-flow',
    title: 'Queue Counter Service Flow',
    risk: 'Counter-level queue servicing can skip audit steps or fail fairness constraints.',
    holeHypothesis:
      'Queue counter calls and queue entry progression may desync under retries and cancellations.',
    routeAreas: ['queues', 'queue-counters', 'operations'],
    endpointExamples: ['/api/v1/bizes/:bizId/queues', '/api/v1/bizes/:bizId/queue-ticket-calls'],
  },
  {
    id: 18,
    slug: 'waitlist-to-booking-conversion',
    title: 'Waitlist To Booking Conversion',
    risk: 'Waitlist conversion bypasses pricing and entitlement checks under urgency flows.',
    holeHypothesis:
      'Queue promotion and booking creation are not atomically coupled.',
    routeAreas: ['queues', 'bookings', 'promotions'],
    endpointExamples: ['/api/v1/bizes/:bizId/queue-entries', '/api/v1/public/bizes/:bizId/booking-orders'],
  },
  {
    id: 19,
    slug: 'crm-pipeline-conversion',
    title: 'CRM Lead To Opportunity Conversion',
    risk: 'Lead-stage transitions can lose attribution data needed for growth analytics.',
    holeHypothesis:
      'Pipeline stage mutation and contact linkage are inconsistently enforced.',
    routeAreas: ['crm', 'customer-ops', 'marketing-performance'],
    endpointExamples: ['/api/v1/bizes/:bizId/crm/leads', '/api/v1/bizes/:bizId/crm/opportunities'],
  },
  {
    id: 20,
    slug: 'communications-delivery-fallback',
    title: 'Communications Delivery And Fallback',
    risk: 'Primary channel failure does not trigger configured fallback or causes duplicate sends.',
    holeHypothesis:
      'Delivery status and fallback policy can diverge when channel integrations are degraded.',
    routeAreas: ['communications', 'channels', 'notification-endpoints'],
    endpointExamples: ['/api/v1/bizes/:bizId/messages', '/api/v1/users/me/notification-endpoints'],
  },
  {
    id: 21,
    slug: 'notification-preference-consistency',
    title: 'Notification Preference Consistency',
    risk: 'User-level mute/preferences are bypassed by campaign or workflow sends.',
    holeHypothesis:
      'Preference checks are applied on direct sends but missed on automated sends.',
    routeAreas: ['notification-endpoints', 'subject-subscriptions', 'communications'],
    endpointExamples: ['/api/v1/users/me/notification-endpoints', '/api/v1/bizes/:bizId/subject-subscriptions'],
  },
  {
    id: 22,
    slug: 'compliance-consent-redaction',
    title: 'Consent And Redaction Controls',
    risk: 'PII or sensitive events can remain visible after consent revocation or data deletion requests.',
    holeHypothesis:
      'Consent state and data redaction jobs are not fully synchronized across domains.',
    routeAreas: ['compliance', 'hipaa', 'customer-ops'],
    endpointExamples: ['/api/v1/bizes/:bizId/compliance/consents', '/api/v1/bizes/:bizId/compliance/data-requests'],
  },
  {
    id: 23,
    slug: 'hipaa-audit-e2e',
    title: 'HIPAA Audit Trail End To End',
    risk: 'Sensitive operations execute without complete access audit and reason capture.',
    holeHypothesis:
      'Operational routes may write state but not complete compliance-grade audit evidence.',
    routeAreas: ['hipaa', 'audit', 'auth-machine'],
    endpointExamples: ['/api/v1/bizes/:bizId/hipaa/access-audits', '/api/v1/auth/events'],
  },
  {
    id: 24,
    slug: 'governance-approvals',
    title: 'Governance Approval Gates',
    risk: 'High-risk actions execute without mandatory approvals under edge conditions.',
    holeHypothesis:
      'Policy evaluation and action execution path can diverge in retry/replay scenarios.',
    routeAreas: ['governance', 'actions', 'policies'],
    endpointExamples: ['/api/v1/bizes/:bizId/governance/approval-requests', '/api/v1/bizes/:bizId/actions/execute'],
  },
  {
    id: 25,
    slug: 'extensions-lifecycle-hooks',
    title: 'Lifecycle Hook Extension Safety',
    risk: 'Extensions mutate line items or state without deterministic ordering and rollback semantics.',
    holeHypothesis:
      'Hook execution order and failure policy are not consistently enforced across hook points.',
    routeAreas: ['extensions', 'lifecycle-hooks', 'checkout'],
    endpointExamples: ['/api/v1/bizes/:bizId/extensions', '/api/v1/bizes/:bizId/lifecycle-hooks'],
  },
  {
    id: 26,
    slug: 'custom-fields-schema-evolution',
    title: 'Custom Field Schema Evolution',
    risk: 'Custom field contract changes break reads/writes or historical records.',
    holeHypothesis:
      'Schema evolution rules are enforced on create but not on update/query surfaces.',
    routeAreas: ['custom-fields', 'customer-ops', 'reporting'],
    endpointExamples: ['/api/v1/bizes/:bizId/custom-field-definitions', '/api/v1/bizes/:bizId/custom-field-values'],
  },
  {
    id: 27,
    slug: 'enterprise-multi-biz-governance',
    title: 'Enterprise Multi Biz Governance',
    risk: 'Enterprise-level controls fail to consistently apply across child bizes.',
    holeHypothesis:
      'Cross-biz policy and data views can leak or omit entities under hierarchy edges.',
    routeAreas: ['enterprise', 'bizes', 'governance'],
    endpointExamples: ['/api/v1/enterprise/accounts', '/api/v1/enterprise/relationships'],
  },
  {
    id: 28,
    slug: 'staffing-shift-openings',
    title: 'Staffing Shift And Openings Market',
    risk: 'Shift handoff/opening claims can result in double assignment or missing compensation linkage.',
    holeHypothesis:
      'Claim/bid flows are not fully constrained by active staffing commitments.',
    routeAreas: ['staffing', 'compensation', 'work-management'],
    endpointExamples: ['/api/v1/bizes/:bizId/staffing/openings', '/api/v1/bizes/:bizId/staffing/assignments'],
  },
  {
    id: 29,
    slug: 'compensation-ledger-accuracy',
    title: 'Compensation Ledger Accuracy',
    risk: 'Commission rules and payout ledgers drift from actual fulfillment and revenue events.',
    holeHypothesis:
      'Compensation snapshots and recomputations are not idempotent under corrections.',
    routeAreas: ['compensation', 'payments', 'reporting'],
    endpointExamples: ['/api/v1/bizes/:bizId/compensation/plans', '/api/v1/bizes/:bizId/compensation/ledger'],
  },
  {
    id: 30,
    slug: 'work-management-handoff',
    title: 'Work Management Handoff Integrity',
    risk: 'Task transitions and assignment changes lose operational context during escalation.',
    holeHypothesis:
      'Task update surfaces permit invalid state hops in race windows.',
    routeAreas: ['work-management', 'operations', 'dispatch'],
    endpointExamples: ['/api/v1/bizes/:bizId/work-items', '/api/v1/bizes/:bizId/work-item-events'],
  },
  {
    id: 31,
    slug: 'instruments-intake-safety',
    title: 'Intake Instrument Safety And Completion',
    risk: 'Required intake/assessment flows are bypassed before booking or fulfillment execution.',
    holeHypothesis:
      'Instrument completion gating can be skipped when booking is created through alternate flows.',
    routeAreas: ['instruments', 'bookings', 'customer-ops'],
    endpointExamples: ['/api/v1/bizes/:bizId/instrument-runs', '/api/v1/public/bizes/:bizId/instrument-runs/:instrumentRunId/submit'],
  },
  {
    id: 32,
    slug: 'subject-events-subscriptions',
    title: 'Subject Event Subscription Integrity',
    risk: 'Subject subscriptions miss events or deliver duplicates under high event throughput.',
    holeHypothesis:
      'Subscription filtering and delivery checkpoints drift under replay conditions.',
    routeAreas: ['subject-events', 'subject-subscriptions', 'channels'],
    endpointExamples: ['/api/v1/bizes/:bizId/subject-events', '/api/v1/bizes/:bizId/subject-subscriptions'],
  },
  {
    id: 33,
    slug: 'ooda-loop-traceability',
    title: 'OODA Loop And Run Traceability',
    risk: 'Loop decisions and run evidence diverge, weakening the evolution feedback loop.',
    holeHypothesis:
      'Loop entries/actions/links can become stale without deterministic reconciliation.',
    routeAreas: ['ooda', 'sagas', 'agents'],
    endpointExamples: ['/api/v1/ooda/overview', '/api/v1/ooda/loops/:loopId/blockers'],
  },
  {
    id: 34,
    slug: 'inventory-replenishment-procurement',
    title: 'Inventory Replenishment And Procurement Lifecycle',
    risk: 'Replenishment planning and procurement order state drift can produce stockouts or over-ordering.',
    holeHypothesis:
      'Supplier setup, replenishment run updates, and procurement order lifecycle are not fully coherent under repeated edits.',
    routeAreas: ['inventory', 'supply', 'procurement'],
    endpointExamples: ['/api/v1/bizes/:bizId/inventory-replenishment-runs', '/api/v1/bizes/:bizId/inventory-procurement-orders'],
  },
  {
    id: 35,
    slug: 'value-ledger-transfer-traceability',
    title: 'Value Ledger Posting And Transfer Traceability',
    risk: 'Value balances and transfer outcomes can diverge from immutable ledger evidence under replay conditions.',
    holeHypothesis:
      'Program/account setup, ledger posting, and transfer completion are not always contract-coherent end-to-end.',
    routeAreas: ['value-programs', 'ledger', 'transfers'],
    endpointExamples: ['/api/v1/bizes/:bizId/value-accounts/:valueAccountId/ledger-entries', '/api/v1/bizes/:bizId/value-transfers/:valueTransferId/decision'],
  },
  {
    id: 36,
    slug: 'workforce-hire-performance-lifecycle',
    title: 'Workforce Hire And Performance Lifecycle',
    risk: 'Hiring and performance records can drift across requisition, assignment, and review artifacts.',
    holeHypothesis:
      'Candidate-to-hire workflow and performance cycle execution are not fully synchronized across write/read surfaces.',
    routeAreas: ['workforce', 'hiring', 'performance'],
    endpointExamples: ['/api/v1/bizes/:bizId/workforce-applications/:workforceApplicationId/hire', '/api/v1/bizes/:bizId/workforce-performance-reviews'],
  },
]

function parseArgs(): CliOptions {
  const args = new Map(
    process.argv
      .slice(2)
      .filter((arg) => arg.startsWith('--'))
      .map((arg) => {
        const [k, v] = arg.slice(2).split('=')
        return [k, v ?? 'true']
      }),
  )

  return {
    sync: args.get('sync') !== 'false',
    overwrite: args.get('overwrite') !== 'false',
  }
}

function prettyThemeId(id: number) {
  return String(id).padStart(2, '0')
}

function sagaKeyFor(theme: Theme, depth: SagaDepth) {
  return `hole-${prettyThemeId(theme.id)}-${theme.slug}-${depth}`
}

function commonActors() {
  return [
    {
      actorKey: 'biz_owner',
      name: 'Biz Owner',
      role: 'owner',
      description: 'Primary operator configuring and validating business lifecycle behavior.',
      personaRef: 'HOLE-P1',
    },
    {
      actorKey: 'biz_member',
      name: 'Biz Member',
      role: 'manager',
      description: 'Operational user handling day to day execution updates.',
      personaRef: 'HOLE-P2',
    },
    {
      actorKey: 'customer',
      name: 'Customer',
      role: 'customer',
      description: 'External actor exercising customer facing journeys.',
      personaRef: 'HOLE-P3',
    },
    {
      actorKey: 'adversary',
      name: 'Adversary',
      role: 'malicious_actor',
      description: 'Actor attempting boundary or abuse behavior to validate protections.',
      personaRef: 'HOLE-P4',
    },
  ]
}

function evidenceDefault() {
  return [
    { kind: 'api_trace' as const, label: 'Request and response trace' },
    { kind: 'snapshot' as const, label: 'User visible state snapshot' },
  ]
}

function assertionsDefault() {
  return [
    { kind: 'api_response', description: 'Endpoint returns expected success or controlled denial.' },
    { kind: 'acl_guard', description: 'Actor permissions and biz scope boundaries are enforced.' },
  ]
}

function makeStep(input: {
  stepKey: string
  order: number
  title: string
  actorKey: string
  intent: string
  instruction: string
  expectedResult: string
  tags: string[]
  toolHints?: string[]
  delay?: {
    mode: 'none' | 'fixed' | 'until_condition'
    delayMs?: number
    conditionKey?: string
    timeoutMs?: number
    pollMs?: number
    jitterMs?: number
    note?: string
  }
}) {
  return {
    stepKey: input.stepKey,
    order: input.order,
    title: input.title,
    actorKey: input.actorKey,
    intent: input.intent,
    instruction: input.instruction,
    expectedResult: input.expectedResult,
    toolHints: input.toolHints ?? [],
    assertions: assertionsDefault(),
    evidenceRequired: evidenceDefault(),
    guardrails: [],
    tags: input.tags,
    delay: input.delay ?? { mode: 'none', jitterMs: 0 },
  }
}

function buildInventoryCoveragePhases(depth: SagaDepth) {
  const includeDeepReplay = depth === 'deep'
  let order = 1
  const nextOrder = () => {
    const current = order
    order += 1
    return current
  }

  return [
    {
      phaseKey: 'inventory-baseline',
      order: 1,
      title: 'Inventory Baseline',
      description: 'Create supply and replenishment fixtures required for procurement lifecycle checks.',
      steps: [
        makeStep({
          stepKey: 'owner-auth-context',
          order: nextOrder(),
          title: 'Owner confirms authenticated context',
          actorKey: 'biz_owner',
          intent: 'Ensure owner context is ready for inventory fixture creation.',
          instruction: 'Verify owner auth and active biz scope before inventory setup.',
          expectedResult: 'Owner context is active and scoped correctly.',
          tags: ['auth', 'inventory'],
        }),
        makeStep({
          stepKey: 'inventory-owner-create-baseline',
          order: nextOrder(),
          title: 'Owner creates inventory baseline',
          actorKey: 'biz_owner',
          intent: 'Provision supply partner and replenishment run fixtures.',
          instruction: 'Create supply partner and replenishment run records and persist resulting ids in run context.',
          expectedResult: 'Inventory baseline entities exist and are reusable by downstream steps.',
          tags: ['inventory', 'baseline'],
        }),
      ],
    },
    {
      phaseKey: 'inventory-lifecycle',
      order: 2,
      title: 'Inventory Lifecycle',
      description: 'Exercise procurement lifecycle mutation/read behavior with role transitions.',
      steps: [
        makeStep({
          stepKey: 'inventory-owner-create-procurement-order',
          order: nextOrder(),
          title: 'Owner creates procurement order',
          actorKey: 'biz_owner',
          intent: 'Validate procurement order creation linked to replenishment context.',
          instruction: 'Create a procurement order linked to supply partner and replenishment run.',
          expectedResult: 'Procurement order is created with deterministic identifiers and status.',
          tags: ['inventory', 'procurement'],
        }),
        makeStep({
          stepKey: 'inventory-member-update-procurement-order',
          order: nextOrder(),
          title: 'Member updates procurement order lifecycle',
          actorKey: 'biz_member',
          intent: 'Validate delegated member mutation within allowed scope.',
          instruction: 'As biz member, patch procurement order lifecycle fields and verify update persistence.',
          expectedResult: 'Member update succeeds and lifecycle fields reflect latest values.',
          tags: ['inventory', 'acl', 'operations'],
        }),
        makeStep({
          stepKey: 'inventory-owner-read-replenishment-state',
          order: nextOrder(),
          title: 'Owner verifies replenishment + procurement reads',
          actorKey: 'biz_owner',
          intent: 'Ensure read models stay coherent with lifecycle writes.',
          instruction: 'Read partner, run, suggestion, and procurement list endpoints and verify coherent state.',
          expectedResult: 'Read surfaces are contract-valid and coherent with prior writes.',
          tags: ['inventory', 'reads'],
        }),
        ...(includeDeepReplay
          ? [
              makeStep({
                stepKey: 'inventory-owner-idempotent-procurement-patch',
                order: nextOrder(),
                title: 'Owner replays procurement patch',
                actorKey: 'biz_owner',
                intent: 'Catch unsafe duplicate side effects on repeated lifecycle mutation.',
                instruction: 'Replay same procurement patch intent twice and verify safe replay behavior.',
                expectedResult: 'Repeated patch remains deterministic without duplicate side effects.',
                tags: ['inventory', 'idempotency'],
              }),
            ]
          : []),
      ],
    },
    {
      phaseKey: 'inventory-boundary',
      order: 3,
      title: 'Inventory Boundary',
      description: 'Validate unauthorized access denial for procurement surfaces.',
      steps: [
        makeStep({
          stepKey: 'inventory-adversary-cross-scope-denied',
          order: nextOrder(),
          title: 'Adversary inventory read is denied',
          actorKey: 'adversary',
          intent: 'Ensure procurement reads are protected from out-of-scope actors.',
          instruction: 'Attempt inventory procurement read as adversary and verify deterministic denial.',
          expectedResult: 'Unauthorized inventory access is denied with stable error behavior.',
          tags: ['inventory', 'security'],
        }),
      ],
    },
  ]
}

function buildValueCoveragePhases(depth: SagaDepth) {
  const includeDeepReplay = depth === 'deep'
  let order = 1
  const nextOrder = () => {
    const current = order
    order += 1
    return current
  }

  return [
    {
      phaseKey: 'value-baseline',
      order: 1,
      title: 'Value Baseline',
      description: 'Provision program and account fixtures used by ledger and transfer lifecycle checks.',
      steps: [
        makeStep({
          stepKey: 'owner-auth-context',
          order: nextOrder(),
          title: 'Owner confirms authenticated context',
          actorKey: 'biz_owner',
          intent: 'Ensure owner context is ready for value domain operations.',
          instruction: 'Verify owner auth and active biz scope before value fixture setup.',
          expectedResult: 'Owner context is active and scoped correctly.',
          tags: ['auth', 'value'],
        }),
        makeStep({
          stepKey: 'value-owner-create-baseline',
          order: nextOrder(),
          title: 'Owner creates value baseline',
          actorKey: 'biz_owner',
          intent: 'Create value program and accounts required for transfer workflow.',
          instruction: 'Create value program + two value accounts and seed starting balance.',
          expectedResult: 'Value baseline entities exist and are ready for ledger/transfer execution.',
          tags: ['value', 'baseline'],
        }),
      ],
    },
    {
      phaseKey: 'value-ledger-transfer',
      order: 2,
      title: 'Value Ledger And Transfer',
      description: 'Validate immutable ledger posting and transfer decision lifecycle.',
      steps: [
        makeStep({
          stepKey: 'value-owner-post-ledger-entry',
          order: nextOrder(),
          title: 'Owner posts ledger entry',
          actorKey: 'biz_owner',
          intent: 'Ensure direct ledger posting updates account balance deterministically.',
          instruction: 'Post one ledger entry to source account and verify persisted balance delta.',
          expectedResult: 'Ledger entry persists with coherent account balance.',
          tags: ['value', 'ledger'],
        }),
        makeStep({
          stepKey: 'value-owner-complete-transfer',
          order: nextOrder(),
          title: 'Owner completes transfer lifecycle',
          actorKey: 'biz_owner',
          intent: 'Validate transfer decision path and resulting paired ledger records.',
          instruction: 'Create transfer between accounts and complete it through transfer decision endpoint.',
          expectedResult: 'Transfer completes and produces coherent source/target ledger outcomes.',
          tags: ['value', 'transfer'],
        }),
        makeStep({
          stepKey: 'value-owner-read-ledger-state',
          order: nextOrder(),
          title: 'Owner verifies ledger read state',
          actorKey: 'biz_owner',
          intent: 'Ensure read surfaces reflect executed postings and transfers.',
          instruction: 'Read value programs, accounts, ledger entries, and transfer lists to verify consistency.',
          expectedResult: 'Read surfaces are coherent with previous write lifecycle steps.',
          tags: ['value', 'reads'],
        }),
        makeStep({
          stepKey: 'value-member-read-ledger-state',
          order: nextOrder(),
          title: 'Member verifies value read access',
          actorKey: 'biz_member',
          intent: 'Validate member read path under delegated biz access.',
          instruction: 'As biz member, read value program/account/transfer endpoints and verify scoped access.',
          expectedResult: 'Member read access is allowed and scoped correctly.',
          tags: ['value', 'acl'],
        }),
        ...(includeDeepReplay
          ? [
              makeStep({
                stepKey: 'value-owner-idempotent-transfer-decision',
                order: nextOrder(),
                title: 'Owner replays transfer decision intent',
                actorKey: 'biz_owner',
                intent: 'Catch duplicate side effects when transfer completion is retried.',
                instruction: 'Replay transfer completion decision and verify conflict-safe deterministic behavior.',
                expectedResult: 'Replay is safe and does not duplicate balance impact.',
                tags: ['value', 'idempotency'],
              }),
            ]
          : []),
      ],
    },
    {
      phaseKey: 'value-boundary',
      order: 3,
      title: 'Value Boundary',
      description: 'Validate unauthorized read denial for value program endpoints.',
      steps: [
        makeStep({
          stepKey: 'value-adversary-cross-scope-denied',
          order: nextOrder(),
          title: 'Adversary value read is denied',
          actorKey: 'adversary',
          intent: 'Ensure non-member actors cannot access value ledger state.',
          instruction: 'Attempt value transfer or account reads as adversary and verify deterministic denial.',
          expectedResult: 'Unauthorized value access is denied with stable error behavior.',
          tags: ['value', 'security'],
        }),
      ],
    },
  ]
}

function buildWorkforceCoveragePhases(depth: SagaDepth) {
  const includeDeepReplay = depth === 'deep'
  let order = 1
  const nextOrder = () => {
    const current = order
    order += 1
    return current
  }

  return [
    {
      phaseKey: 'workforce-baseline',
      order: 1,
      title: 'Workforce Baseline',
      description: 'Provision department/position/requisition/candidate/application fixtures.',
      steps: [
        makeStep({
          stepKey: 'owner-auth-context',
          order: nextOrder(),
          title: 'Owner confirms authenticated context',
          actorKey: 'biz_owner',
          intent: 'Ensure owner context is ready for workforce lifecycle operations.',
          instruction: 'Verify owner auth and active biz scope before workforce setup.',
          expectedResult: 'Owner context is active and scoped correctly.',
          tags: ['auth', 'workforce'],
        }),
        makeStep({
          stepKey: 'workforce-owner-create-baseline',
          order: nextOrder(),
          title: 'Owner creates workforce baseline',
          actorKey: 'biz_owner',
          intent: 'Create core hiring fixtures for downstream hire/performance checks.',
          instruction: 'Create department, position, requisition, candidate, and application fixtures.',
          expectedResult: 'Hiring baseline entities are available and linked correctly.',
          tags: ['workforce', 'baseline'],
        }),
      ],
    },
    {
      phaseKey: 'workforce-lifecycle',
      order: 2,
      title: 'Workforce Lifecycle',
      description: 'Run hire workflow and performance cycle execution.',
      steps: [
        makeStep({
          stepKey: 'workforce-owner-progress-hire',
          order: nextOrder(),
          title: 'Owner completes hire workflow',
          actorKey: 'biz_owner',
          intent: 'Validate candidate application to assignment transition.',
          instruction: 'Execute hire endpoint for application and verify assignment linkage plus requisition updates.',
          expectedResult: 'Hire workflow succeeds with coherent assignment/application/requisition state.',
          tags: ['workforce', 'hiring'],
        }),
        makeStep({
          stepKey: 'workforce-owner-run-performance-cycle',
          order: nextOrder(),
          title: 'Owner runs performance cycle workflow',
          actorKey: 'biz_owner',
          intent: 'Validate performance cycle and review creation against hired assignment.',
          instruction: 'Create performance cycle + review, then verify review lifecycle update behavior.',
          expectedResult: 'Performance records persist with coherent cycle/assignment linkage.',
          tags: ['workforce', 'performance'],
        }),
        makeStep({
          stepKey: 'workforce-member-read-workforce-state',
          order: nextOrder(),
          title: 'Member verifies workforce read state',
          actorKey: 'biz_member',
          intent: 'Ensure delegated actor can read workforce lifecycle artifacts.',
          instruction: 'As biz member, read requisitions, applications, and performance review endpoints.',
          expectedResult: 'Member read behavior is allowed and returns scoped workforce artifacts.',
          tags: ['workforce', 'acl'],
        }),
        ...(includeDeepReplay
          ? [
              makeStep({
                stepKey: 'workforce-owner-idempotent-review-update',
                order: nextOrder(),
                title: 'Owner replays performance review update',
                actorKey: 'biz_owner',
                intent: 'Catch unsafe duplicate side effects on repeated review lifecycle updates.',
                instruction: 'Replay identical performance review patch twice and verify deterministic outcomes.',
                expectedResult: 'Repeated review update remains stable without invalid side effects.',
                tags: ['workforce', 'idempotency'],
              }),
            ]
          : []),
      ],
    },
    {
      phaseKey: 'workforce-boundary',
      order: 3,
      title: 'Workforce Boundary',
      description: 'Validate unauthorized access denial for workforce endpoints.',
      steps: [
        makeStep({
          stepKey: 'workforce-adversary-cross-scope-denied',
          order: nextOrder(),
          title: 'Adversary workforce read is denied',
          actorKey: 'adversary',
          intent: 'Ensure non-member actors cannot access workforce lifecycle state.',
          instruction: 'Attempt workforce read operations as adversary and verify deterministic denial.',
          expectedResult: 'Unauthorized workforce access is denied with stable error behavior.',
          tags: ['workforce', 'security'],
        }),
      ],
    },
  ]
}

function buildPhases(theme: Theme, depth: SagaDepth) {
  if (theme.slug === 'inventory-replenishment-procurement') {
    return buildInventoryCoveragePhases(depth)
  }
  if (theme.slug === 'value-ledger-transfer-traceability') {
    return buildValueCoveragePhases(depth)
  }
  if (theme.slug === 'workforce-hire-performance-lifecycle') {
    return buildWorkforceCoveragePhases(depth)
  }

  const endpointHint = theme.endpointExamples.join(' ; ')

  if (depth === 'shallow') {
    return [
      {
        phaseKey: 'contract-smoke',
        order: 1,
        title: 'Contract Smoke',
        description: 'Quick signal that core route contracts are alive and scoped correctly.',
        steps: [
          makeStep({
            stepKey: 'owner-auth-context',
            order: 1,
            title: 'Owner confirms authenticated context',
            actorKey: 'biz_owner',
            intent: 'Verify authenticated access baseline before domain checks.',
            instruction:
              'Call authenticated context and verify actor identity can reach protected API routes in the intended biz scope.',
            expectedResult: 'Authenticated actor context is valid and scoped as expected.',
            tags: ['smoke', 'auth'],
            toolHints: ['bizing.auth.context.get'],
          }),
          makeStep({
            stepKey: 'owner-endpoint-discovery',
            order: 2,
            title: 'Owner validates endpoint discovery for theme',
            actorKey: 'biz_owner',
            intent: 'Ensure discoverability remains aligned with implemented routes.',
            instruction: `Use OpenAPI or agents tool discovery to confirm these endpoints are visible: ${endpointHint}.`,
            expectedResult: 'Theme endpoints are discoverable with expected path signatures.',
            tags: ['smoke', 'discoverability'],
            toolHints: ['bizing.agents.openapi.catalog', 'bizing.agents.search'],
          }),
          makeStep({
            stepKey: 'owner-minimal-domain-write-read',
            order: 3,
            title: 'Owner performs minimal domain write and readback',
            actorKey: 'biz_owner',
            intent: 'Verify one canonical create/update and read path for this domain.',
            instruction:
              `Execute one minimal write in ${theme.title} domain, then read back and verify persistence and shape correctness.`,
            expectedResult: 'Minimal write persists and readback matches expected contract.',
            tags: ['smoke', 'crud'],
            toolHints: ['bizing.api.raw'],
          }),
        ],
      },
      {
        phaseKey: 'boundary-smoke',
        order: 2,
        title: 'Boundary Smoke',
        description: 'Quick cross actor and security boundary validation.',
        steps: [
          makeStep({
            stepKey: 'adversary-cross-scope-denied',
            order: 4,
            title: 'Adversary cross scope attempt is denied',
            actorKey: 'adversary',
            intent: 'Catch obvious authz boundary regressions quickly.',
            instruction:
              'Attempt a cross biz read or mutation for the same domain and confirm deterministic denial.',
            expectedResult: 'Unauthorized attempt is denied with stable error code.',
            tags: ['security', 'smoke'],
            toolHints: ['bizing.api.raw'],
          }),
          makeStep({
            stepKey: 'owner-audit-signal-check',
            order: 5,
            title: 'Owner sees traceable signal for tested operation',
            actorKey: 'biz_owner',
            intent: 'Ensure tested operation leaves enough evidence for debugging.',
            instruction:
              'Read action, event, or saga evidence endpoints and confirm operation is traceable with request identifiers.',
            expectedResult: 'Evidence exists to explain what happened and why.',
            tags: ['audit', 'smoke'],
            toolHints: ['bizing.events.list', 'bizing.actions.list'],
          }),
        ],
      },
    ]
  }

  if (depth === 'medium') {
    return [
      {
        phaseKey: 'setup-and-baseline',
        order: 1,
        title: 'Setup And Baseline',
        description: 'Create realistic baseline entities for the domain under test.',
        steps: [
          makeStep({
            stepKey: 'owner-auth-context',
            order: 1,
            title: 'Owner confirms authenticated context',
            actorKey: 'biz_owner',
            intent: 'Ensure baseline auth scope before medium regression checks.',
            instruction: 'Verify owner auth context and active biz scope used for this test run.',
            expectedResult: 'Owner context is active and scoped correctly.',
            tags: ['auth', 'baseline'],
          }),
          makeStep({
            stepKey: 'owner-create-domain-baseline',
            order: 2,
            title: 'Owner creates baseline entities',
            actorKey: 'biz_owner',
            intent: 'Build deterministic baseline objects for downstream assertions.',
            instruction: `Create baseline entities required for ${theme.title} and store resulting ids in run context.`,
            expectedResult: 'Baseline entities exist and can be referenced in later steps.',
            tags: ['baseline', 'crud'],
            toolHints: ['bizing.api.raw'],
            delay: {
              mode: 'fixed',
              delayMs: 120000,
              jitterMs: 0,
              note: 'Simulate operator configuration time between setup actions.',
            },
          }),
          makeStep({
            stepKey: 'owner-validate-contract-shape',
            order: 3,
            title: 'Owner validates read model shape',
            actorKey: 'biz_owner',
            intent: 'Catch schema or serializer drift early.',
            instruction: 'Read baseline entities and assert required fields and nested shapes are stable.',
            expectedResult: 'Read model shape matches current contract expectations.',
            tags: ['contract', 'baseline'],
          }),
        ],
      },
      {
        phaseKey: 'lifecycle-execution',
        order: 2,
        title: 'Lifecycle Execution',
        description: 'Exercise realistic domain lifecycle transitions across actors.',
        steps: [
          makeStep({
            stepKey: 'member-operational-update',
            order: 4,
            title: 'Member performs operational update',
            actorKey: 'biz_member',
            intent: 'Validate member role behavior under scoped permissions.',
            instruction: `As biz member, perform an operational update in ${theme.title} and verify allowed transitions.`,
            expectedResult: 'Operational update succeeds for member within role limits.',
            tags: ['operations', 'acl'],
          }),
          makeStep({
            stepKey: 'customer-facing-flow',
            order: 5,
            title: 'Customer triggers related flow',
            actorKey: 'customer',
            intent: 'Validate customer visible interaction around this domain.',
            instruction:
              'Execute one customer-facing path touching this domain and confirm UX-safe response semantics.',
            expectedResult: 'Customer flow succeeds or fails with intentional user-safe messaging.',
            tags: ['customer', 'lifecycle'],
          }),
          makeStep({
            stepKey: 'owner-idempotent-repeat',
            order: 6,
            title: 'Owner repeats write to test idempotent behavior',
            actorKey: 'biz_owner',
            intent: 'Detect duplicate write side effects under retries.',
            instruction: 'Replay the same mutation intent and validate dedupe, conflict handling, or safe no-op behavior.',
            expectedResult: 'Repeated intent does not create unsafe duplicate state.',
            tags: ['idempotency', 'retries'],
          }),
          makeStep({
            stepKey: 'owner-check-derived-reads',
            order: 7,
            title: 'Owner verifies derived reads',
            actorKey: 'biz_owner',
            intent: 'Ensure projections and summary endpoints remain coherent.',
            instruction: 'Read summary, timeline, or analytics endpoints related to this domain and verify coherence.',
            expectedResult: 'Derived reads remain internally consistent with write operations.',
            tags: ['projections', 'reporting'],
          }),
        ],
      },
      {
        phaseKey: 'resilience-and-closeout',
        order: 3,
        title: 'Resilience And Closeout',
        description: 'Validate guardrails, denial paths, and evidence quality.',
        steps: [
          makeStep({
            stepKey: 'adversary-boundary-attempt',
            order: 8,
            title: 'Adversary boundary attempt is denied',
            actorKey: 'adversary',
            intent: 'Ensure cross actor boundaries hold under medium stress.',
            instruction: 'Attempt out-of-scope read or mutation and validate deterministic denial code.',
            expectedResult: 'Unauthorized path is denied and traceable.',
            tags: ['security', 'boundary'],
          }),
          makeStep({
            stepKey: 'owner-evidence-review',
            order: 9,
            title: 'Owner reviews events and action traces',
            actorKey: 'biz_owner',
            intent: 'Ensure debugging context is complete enough for incident triage.',
            instruction:
              'Collect action, event, and failure evidence for this run and verify references are sufficient for replay.',
            expectedResult: 'Evidence can explain outcomes without manual DB forensics.',
            tags: ['audit', 'debugging'],
            delay: {
              mode: 'until_condition',
              conditionKey: 'step_done:adversary-boundary-attempt',
              timeoutMs: 30000,
              pollMs: 1000,
              jitterMs: 0,
              note: 'Wait for security check completion before final evidence review.',
            },
          }),
        ],
      },
    ]
  }

  return [
    {
      phaseKey: 'deep-setup',
      order: 1,
      title: 'Deep Setup',
      description: 'Build full realistic fixture set and cross actor contexts.',
      steps: [
        makeStep({
          stepKey: 'owner-auth-context',
          order: 1,
          title: 'Owner confirms authenticated context',
          actorKey: 'biz_owner',
          intent: 'Establish primary control context for deep scenario.',
          instruction: 'Verify owner auth and biz scope context for deep run.',
          expectedResult: 'Owner context ready for deep lifecycle execution.',
          tags: ['auth', 'deep'],
        }),
        makeStep({
          stepKey: 'owner-bootstrap-fixtures',
          order: 2,
          title: 'Owner bootstraps complex fixtures',
          actorKey: 'biz_owner',
          intent: 'Provision all dependent entities and toggles used in deep checks.',
          instruction: `Create complete fixtures for ${theme.title}, including optional configs and fallback paths.`,
          expectedResult: 'All prerequisite fixtures exist and are linked correctly.',
          tags: ['fixtures', 'deep'],
          delay: {
            mode: 'fixed',
            delayMs: 300000,
            jitterMs: 0,
            note: 'Simulate realistic setup interval for complex configuration.',
          },
        }),
        makeStep({
          stepKey: 'owner-discovery-and-contract',
          order: 3,
          title: 'Owner validates endpoint and contract coverage',
          actorKey: 'biz_owner',
          intent: 'Ensure API discovery and route contracts are aligned with runtime.',
          instruction: `Verify route discovery and contract fitness for: ${endpointHint}.`,
          expectedResult: 'Contract and discovery remain coherent before stress execution.',
          tags: ['contract', 'discoverability'],
        }),
      ],
    },
    {
      phaseKey: 'deep-lifecycle',
      order: 2,
      title: 'Deep Lifecycle',
      description: 'Run complete owner, member, and customer lifecycle interactions.',
      steps: [
        makeStep({
          stepKey: 'member-operational-flow',
          order: 4,
          title: 'Member executes operational lifecycle',
          actorKey: 'biz_member',
          intent: 'Validate delegated operations under real workflow conditions.',
          instruction: 'Execute multi-step operational flow and verify transitions are legal and persisted.',
          expectedResult: 'Operational flow completes with coherent state progression.',
          tags: ['operations', 'workflow'],
        }),
        makeStep({
          stepKey: 'customer-primary-flow',
          order: 5,
          title: 'Customer completes primary flow',
          actorKey: 'customer',
          intent: 'Validate primary customer journey under complex fixture conditions.',
          instruction: 'Run main customer journey touching this domain and capture visible output and side effects.',
          expectedResult: 'Customer path completes with expected behavior and clear user messaging.',
          tags: ['customer', 'journey'],
        }),
        makeStep({
          stepKey: 'customer-secondary-flow',
          order: 6,
          title: 'Customer triggers secondary variant',
          actorKey: 'customer',
          intent: 'Validate variant path and optional feature interactions.',
          instruction: 'Run a secondary or edge variant of the customer flow and compare outcomes.',
          expectedResult: 'Variant flow behavior is deterministic and policy-compliant.',
          tags: ['customer', 'variants'],
        }),
        makeStep({
          stepKey: 'owner-concurrency-check',
          order: 7,
          title: 'Owner validates concurrent updates',
          actorKey: 'biz_owner',
          intent: 'Stress race windows and conflict handling.',
          instruction: 'Trigger concurrent writes or near-simultaneous updates and verify conflict resolution behavior.',
          expectedResult: 'Concurrency handling is safe, deterministic, and traceable.',
          tags: ['concurrency', 'conflict'],
        }),
        makeStep({
          stepKey: 'owner-idempotent-replay',
          order: 8,
          title: 'Owner replays action intent',
          actorKey: 'biz_owner',
          intent: 'Verify retries and replays do not corrupt lifecycle state.',
          instruction: 'Replay key action intent with same identifying metadata and verify dedupe behavior.',
          expectedResult: 'Replay is safe and does not create duplicate side effects.',
          tags: ['idempotency', 'replay'],
        }),
      ],
    },
    {
      phaseKey: 'deep-failure-and-recovery',
      order: 3,
      title: 'Failure And Recovery',
      description: 'Inject realistic failure and verify recovery plus fallback behavior.',
      steps: [
        makeStep({
          stepKey: 'owner-induced-failure',
          order: 9,
          title: 'Owner triggers controlled failure path',
          actorKey: 'biz_owner',
          intent: 'Validate deterministic failure semantics and error contracts.',
          instruction: 'Trigger one controlled invalid or conflict path and verify stable error shape.',
          expectedResult: 'Failure returns deterministic code and leaves system in recoverable state.',
          tags: ['failure', 'contracts'],
        }),
        makeStep({
          stepKey: 'owner-recovery-flow',
          order: 10,
          title: 'Owner executes recovery flow',
          actorKey: 'biz_owner',
          intent: 'Ensure remediation path returns system to healthy lifecycle state.',
          instruction: 'Execute recommended recovery path and verify expected state restoration.',
          expectedResult: 'Recovery path succeeds without orphaned or contradictory state.',
          tags: ['recovery', 'resilience'],
          delay: {
            mode: 'until_condition',
            conditionKey: 'step_done:owner-induced-failure',
            timeoutMs: 30000,
            pollMs: 1000,
            jitterMs: 0,
            note: 'Recovery should only run after failure evidence is persisted.',
          },
        }),
      ],
    },
    {
      phaseKey: 'deep-security-and-policy',
      order: 4,
      title: 'Security And Policy',
      description: 'Run high-risk unauthorized and policy-gated attempts.',
      steps: [
        makeStep({
          stepKey: 'adversary-cross-scope-read',
          order: 11,
          title: 'Adversary cross scope read attempt',
          actorKey: 'adversary',
          intent: 'Prove data boundary enforcement under deep conditions.',
          instruction: 'Attempt cross-scope read on generated fixtures and verify denial path.',
          expectedResult: 'Cross-scope read is denied and audit signal is present.',
          tags: ['security', 'acl'],
        }),
        makeStep({
          stepKey: 'adversary-cross-scope-write',
          order: 12,
          title: 'Adversary cross scope mutation attempt',
          actorKey: 'adversary',
          intent: 'Prove mutation guardrails under deep conditions.',
          instruction: 'Attempt out-of-scope mutation and verify policy + authz enforcement.',
          expectedResult: 'Mutation is denied with stable code and no side effects.',
          tags: ['security', 'guardrail'],
        }),
        makeStep({
          stepKey: 'owner-policy-reason-check',
          order: 13,
          title: 'Owner verifies policy and approval evidence',
          actorKey: 'biz_owner',
          intent: 'Ensure policy decisions are inspectable and explainable.',
          instruction: 'Read policy/approval evidence linked to denied or gated actions and verify explanation fidelity.',
          expectedResult: 'Policy evidence is sufficient for human debugging and audit.',
          tags: ['policy', 'audit'],
        }),
      ],
    },
    {
      phaseKey: 'deep-traceability-closeout',
      order: 5,
      title: 'Traceability Closeout',
      description: 'Prove end to end explainability for the scenario.',
      steps: [
        makeStep({
          stepKey: 'owner-e2e-trace-collection',
          order: 14,
          title: 'Owner collects action event and run traces',
          actorKey: 'biz_owner',
          intent: 'Validate that platform can explain exactly what happened in this saga.',
          instruction:
            'Collect actions, domain events, workflow artifacts, and saga traces for all critical steps and verify links are navigable.',
          expectedResult: 'End to end evidence chain is complete for this deep run.',
          tags: ['traceability', 'evidence'],
        }),
        makeStep({
          stepKey: 'owner-closeout-summary',
          order: 15,
          title: 'Owner records closeout verdict',
          actorKey: 'biz_owner',
          intent: 'Produce reusable quality signal for OODash triage.',
          instruction:
            'Submit closeout verdict with explicit pass/fail reasons and actionable follow-up when gaps exist.',
          expectedResult: 'Closeout verdict is persisted with clear rationale and next actions.',
          tags: ['closeout', 'ooda'],
        }),
      ],
    },
  ]
}

function buildSpec(theme: Theme, depth: SagaDepth): SagaSpec {
  const sagaKey = sagaKeyFor(theme, depth)
  const depthLabel = depth === 'medium' ? 'Mid' : depth[0].toUpperCase() + depth.slice(1)

  return normalizeSagaSpec({
    schemaVersion: 'saga.v1',
    simulation: {
      clock: {
        mode: 'virtual',
        timezone: 'UTC',
        autoAdvance: true,
      },
      scheduler: {
        mode: 'deterministic',
        defaultPollMs: 1000,
        defaultTimeoutMs: 30000,
        maxTicksPerStep: 500,
      },
    },
    sagaKey,
    title: `Hole Coverage ${prettyThemeId(theme.id)} · ${theme.title} · ${depthLabel}`,
    description: `${theme.risk} Anticipated hole: ${theme.holeHypothesis}`,
    depth,
    tags: [
      'hole-coverage',
      'proactive-gap-detection',
      `depth-${depth}`,
      ...theme.routeAreas.map((area) => `area-${area}`),
    ],
    defaults: {
      runMode: 'dry_run',
      continueOnFailure: false,
    },
    source: {
      useCaseRef: `HOLE-${prettyThemeId(theme.id)}`,
      personaRef: 'HOLE-PACK',
      useCaseFile: '/Users/ameer/bizing/code/apps/api/src/routes',
      personaFile: '/Users/ameer/bizing/mind/workspace/documentation/tester-personas.md',
      generatedAt: new Date().toISOString(),
    },
    objectives: [
      `Anticipate and expose high-risk implementation gaps for ${theme.title}.`,
      'Prove behavior under normal, boundary, and replay conditions using API-only evidence.',
      'Produce deterministic evidence for OODash blocker and reorient workflows.',
    ],
    actors: commonActors(),
    phases: buildPhases(theme, depth),
    metadata: {
      generatedBy: 'generate-hole-sagas.ts',
      themeId: theme.id,
      themeSlug: theme.slug,
      routeAreas: theme.routeAreas,
      endpointExamples: theme.endpointExamples,
      risk: theme.risk,
      anticipatedHole: theme.holeHypothesis,
    },
  })
}

async function saveSpec(spec: SagaSpec, overwrite: boolean, existingKeys: Set<string>) {
  if (!overwrite && existingKeys.has(spec.sagaKey)) return { written: false }

  await upsertSagaDefinitionSpec({
    spec,
    actorUserId: 'system',
    status: 'active',
    forceRevision: true,
  })
  return { written: true }
}

async function main() {
  const options = parseArgs()

  const depths: SagaDepth[] = ['shallow', 'medium', 'deep']
  const allSpecs = depths.flatMap((depth) => THEMES.map((theme) => buildSpec(theme, depth)))

  const existingKeys = options.overwrite
    ? new Set<string>()
    : new Set((await syncSagaDefinitions()).map((row) => row.sagaKey))

  const results = await Promise.all(
    allSpecs.map((spec) => saveSpec(spec, options.overwrite, existingKeys)),
  )
  const writtenCount = results.filter((r) => r.written).length

  let syncedCount = 0
  if (options.sync) {
    const synced = await syncSagaDefinitions()
    syncedCount = synced.length
  }

  const byDepth = depths.map((depth) => ({
    depth,
    count: allSpecs.filter((spec) => spec.depth === depth).length,
  }))

  console.log(
    JSON.stringify(
      {
        ok: true,
        generated: allSpecs.length,
        written: writtenCount,
        byDepth,
        syncedDefinitions: syncedCount,
        firstKey: allSpecs[0]?.sagaKey ?? null,
        lastKey: allSpecs[allSpecs.length - 1]?.sagaKey ?? null,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error('[generate-hole-sagas] failed')
  console.error(error)
  process.exit(1)
})
