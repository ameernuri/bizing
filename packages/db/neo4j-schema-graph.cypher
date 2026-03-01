// Bizing Schema Graph - Cypher Import Script
// Run this in Neo4j Browser or via cypher-shell

// ============================================
// CLEAR EXISTING DATA
// ============================================
MATCH (n) DETACH DELETE n;

// ============================================
// CREATE DOMAIN NODES (Visual Grouping)
// ============================================
CREATE (d1:Domain {name: "Identity & Access", color: "#FF6B6B", icon: "🔐", order: 1})
CREATE (d2:Domain {name: "Catalog & Commerce", color: "#4ECDC4", icon: "🏪", order: 2})
CREATE (d3:Domain {name: "Supply & Resources", color: "#45B7D1", icon: "⚙️", order: 3})
CREATE (d4:Domain {name: "Bookings & Fulfillment", color: "#96CEB4", icon: "📅", order: 4})
CREATE (d5:Domain {name: "Payments & Money", color: "#FFEAA7", icon: "💰", order: 5})
CREATE (d6:Domain {name: "Queue & Waitlist", color: "#DDA0DD", icon: "⏳", order: 6})
CREATE (d7:Domain {name: "Social & Notifications", color: "#98D8C8", icon: "🔔", order: 7})
CREATE (d8:Domain {name: "Marketplace & Multi-Biz", color: "#F7DC6F", icon: "🌐", order: 8})
CREATE (d9:Domain {name: "Enterprise & B2B", color: "#BB8FCE", icon: "🏢", order: 9})
CREATE (d10:Domain {name: "Governance & Compliance", color: "#85C1E2", icon: "⚖️", order: 10});

// ============================================
// IDENTITY & ACCESS DOMAIN
// ============================================

MATCH (d:Domain {name: "Identity & Access"})

CREATE (biz:Entity {
  name: "bizes",
  label: "Biz (Tenant)",
  type: "Root",
  description: "Tenant root - every business gets one. All data scoped by biz_id.",
  keyFields: ["id (ULID)", "name", "slug (unique)", "type", "timezone", "currency", "status"],
  pattern: "Every table references biz_id for strict isolation"
})

CREATE (user:Entity {
  name: "users",
  label: "User",
  type: "Identity",
  description: "Identity root. Better Auth integration. Can belong to multiple bizes via memberships.",
  keyFields: ["id", "email", "name", "phone"]
})

CREATE (membership:Entity {
  name: "memberships",
  label: "Membership",
  type: "Access",
  description: "Biz-specific role assignment. User + Biz + Role.",
  keyFields: ["id", "user_id", "biz_id", "role (owner/admin/manager/staff/host/customer)"]
})

CREATE (group:Entity {
  name: "group_accounts",
  label: "Group Account",
  type: "Identity",
  description: "Shared accounts: families, companies, teams. Enables group bookings.",
  keyFields: ["id", "biz_id", "type (family/company/group)", "name"]
})

CREATE (authz:Entity {
  name: "authz",
  label: "Authorization Matrix",
  type: "Security",
  description: "Role + Permission + Scope + Effect. Deny rows override allow.",
  keyFields: ["role", "permission", "scope_type", "scope_id", "effect (allow/deny)"]
})

CREATE (biz)-[:CONTAINS {type: "1:N", description: "Biz has many users via memberships"}]->(membership)
CREATE (user)-[:HAS {type: "1:N", description: "User has membership in bizes"}]->(membership)
CREATE (biz)-[:HAS_GROUPS {type: "1:N"}]->(group)
CREATE (biz)-[:HAS_AUTHZ {type: "1:N"}]->(authz)

// Link to domain
CREATE (d)-[:INCLUDES]->(biz)
CREATE (d)-[:INCLUDES]->(user)
CREATE (d)-[:INCLUDES]->(membership)
CREATE (d)-[:INCLUDES]->(group)
CREATE (d)-[:INCLUDES]->(authz);

// ============================================
// CATALOG & COMMERCE DOMAIN
// ============================================

MATCH (d:Domain {name: "Catalog & Commerce"})
MATCH (biz:Entity {name: "bizes"})

CREATE (offer:Entity {
  name: "offers",
  label: "Offer (Shell)",
  type: "Catalog",
  description: "Product shell. What you sell. Mutable identity.",
  keyFields: ["id", "biz_id", "name", "slug", "execution_mode (CRITICAL)", "status", "is_published"],
  criticalField: "execution_mode: slot|queue|request|auction|async|route_trip|open_access|itinerary"
})

CREATE (offerVer:Entity {
  name: "offer_versions",
  label: "Offer Version",
  type: "Catalog",
  description: "IMMUTABLE snapshot at purchase time. Historical bookings reference this.",
  keyFields: ["id", "offer_id", "version", "status", "duration_policy", "pricing_model", "capacity_model", "policy_model"],
  immutabilityNote: "Once published, treat as frozen. Bookings point here."
})

CREATE (comp:Entity {
  name: "offer_components",
  label: "Offer Components",
  type: "Catalog",
  description: "Bundle parts. Fixed, optional, or choice groups.",
  keyFields: ["id", "offer_version_id", "component_type", "required"]
})

CREATE (pricing:Entity {
  name: "demand_pricing",
  label: "Demand Pricing",
  type: "Commerce",
  description: "Dynamic pricing rules. Surge, time-based, inventory-based.",
  keyFields: ["id", "offer_id", "pricing_type", "rules"]
})

CREATE (biz)-[:PUBLISHES {type: "1:N"}]->(offer)
CREATE (offer)-[:HAS_VERSION {type: "1:N", description: "Offer has many versions over time"}]->(offerVer)
CREATE (offerVer)-[:CONTAINS {type: "1:N"}]->(comp)
CREATE (offer)-[:HAS_PRICING {type: "1:N"}]->(pricing)

CREATE (d)-[:INCLUDES]->(offer)
CREATE (d)-[:INCLUDES]->(offerVer)
CREATE (d)-[:INCLUDES]->(comp)
CREATE (d)-[:INCLUDES]->(pricing);

// ============================================
// SUPPLY & RESOURCES DOMAIN
// ============================================

MATCH (d:Domain {name: "Supply & Resources"})
MATCH (biz:Entity {name: "bizes"})
MATCH (offerVer:Entity {name: "offer_versions"})

CREATE (resource:Entity {
  name: "resources",
  label: "Resource",
  type: "Supply",
  description: "Polymorphic supply: host, asset, venue. All have calendars.",
  keyFields: ["id", "biz_id", "type (host/company_host/asset/venue)", "name", "status", "calendar_id"],
  polymorphismNote: "Single table, type discriminator. Unified scheduling."
})

CREATE (calendar:Entity {
  name: "calendars",
  label: "Calendar",
  type: "Time",
  description: "Resource availability container. Links to rules.",
  keyFields: ["id", "resource_id", "timezone", "status"]
})

CREATE (availRule:Entity {
  name: "availability_rules",
  label: "Availability Rules",
  type: "Time",
  description: "When resources are available. Recurring, date_range, timestamp_range.",
  keyFields: ["id", "calendar_id", "rule_mode", "frequency", "outcome (open/closed)"],
  precedenceNote: "timestamp_range > date_range > recurring > default_mode"
})

CREATE (availBlock:Entity {
  name: "availability_blocks",
  label: "Availability Blocks",
  type: "Time",
  description: "Booked or busy time. Generated from bookings + manual blocks.",
  keyFields: ["id", "resource_id", "start_at", "end_at", "block_type"]
})

CREATE (location:Entity {
  name: "locations",
  label: "Location",
  type: "Operations",
  description: "Physical or virtual place. Has address, timezone.",
  keyFields: ["id", "biz_id", "name", "type (physical/virtual/mobile/hybrid)", "timezone"]
})

CREATE (biz)-[:OWNS {type: "1:N"}]->(resource)
CREATE (resource)-[:HAS_CALENDAR {type: "1:1"}]->(calendar)
CREATE (calendar)-[:HAS_RULES {type: "1:N"}]->(availRule)
CREATE (resource)-[:HAS_BLOCKS {type: "1:N"}]->(availBlock)
CREATE (biz)-[:OPERATES_AT {type: "1:N"}]->(location)
CREATE (offerVer)-[:USES_RESOURCES {type: "N:M"}]->(resource)

CREATE (d)-[:INCLUDES]->(resource)
CREATE (d)-[:INCLUDES]->(calendar)
CREATE (d)-[:INCLUDES]->(availRule)
CREATE (d)-[:INCLUDES]->(availBlock)
CREATE (d)-[:INCLUDES]->(location);

// ============================================
// BOOKINGS & FULFILLMENT DOMAIN
// ============================================

MATCH (d:Domain {name: "Bookings & Fulfillment"})
MATCH (user:Entity {name: "users"})
MATCH (offerVer:Entity {name: "offer_versions"})
MATCH (resource:Entity {name: "resources"})
MATCH (location:Entity {name: "locations"})

CREATE (booking:Entity {
  name: "booking_orders",
  label: "Booking Order",
  type: "Booking",
  description: "Customer commitment. Immutable snapshots of pricing/policy.",
  keyFields: ["id", "biz_id", "customer_user_id", "offer_version_id", "status", "confirmed_start_at", "confirmed_end_at", "total_minor", "currency"],
  criticalNote: "pricingSnapshot + policySnapshot are JSONB - locked at purchase"
})

CREATE (bookingLine:Entity {
  name: "booking_order_lines",
  label: "Booking Order Lines",
  type: "Booking",
  description: "Line items within order. Main service + add-ons.",
  keyFields: ["id", "booking_order_id", "line_type", "description", "amount_minor"]
})

CREATE (fulfillment:Entity {
  name: "fulfillment_units",
  label: "Fulfillment Unit",
  type: "Delivery",
  description: "Atomic delivery assignment. Who, what, when.",
  keyFields: ["id", "booking_line_id", "resource_id", "kind", "scheduled_start", "scheduled_end", "status"]
})

CREATE (standing:Entity {
  name: "standing_reservation_contracts",
  label: "Standing Reservation",
  type: "Booking",
  description: "Recurring booking contract. RRULE-based.",
  keyFields: ["id", "customer_user_id", "offer_version_id", "recurrence_rule", "anchor_start_at", "status"]
})

CREATE (user)-[:PLACES {type: "1:N"}]->(booking)
CREATE (booking)-[:USES_VERSION {type: "N:1"}]->(offerVer)
CREATE (booking)-[:HAS_LINES {type: "1:N"}]->(bookingLine)
CREATE (bookingLine)-[:SCHEDULED_AS {type: "1:N"}]->(fulfillment)
CREATE (resource)-[:FULFILLS {type: "1:N"}]->(fulfillment)
CREATE (location)-[:HOSTS {type: "1:N"}]->(fulfillment)
CREATE (user)-[:HAS_CONTRACT {type: "1:N"}]->(standing)
CREATE (standing)-[:BASED_ON {type: "N:1"}]->(offerVer)

CREATE (d)-[:INCLUDES]->(booking)
CREATE (d)-[:INCLUDES]->(bookingLine)
CREATE (d)-[:INCLUDES]->(fulfillment)
CREATE (d)-[:INCLUDES]->(standing);

// ============================================
// PAYMENTS & MONEY DOMAIN
// ============================================

MATCH (d:Domain {name: "Payments & Money"})
MATCH (user:Entity {name: "users"})
MATCH (booking:Entity {name: "booking_orders"})
MATCH (biz:Entity {name: "bizes"})

CREATE (paymentMethod:Entity {
  name: "payment_methods",
  label: "Payment Method",
  type: "Payment",
  description: "Customer saved cards, bank accounts, points.",
  keyFields: ["id", "customer_user_id", "type", "last4", "expiry", "is_default"]
})

CREATE (paymentIntent:Entity {
  name: "payment_intents",
  label: "Payment Intent",
  type: "Payment",
  description: "Checkout session + authorization. Holds funds.",
  keyFields: ["id", "biz_id", "booking_order_id", "customer_user_id", "amount_minor", "currency", "status"]
})

CREATE (tender:Entity {
  name: "payment_intent_tenders",
  label: "Tender",
  type: "Payment",
  description: "How customer pays. Split payments: card + points.",
  keyFields: ["id", "payment_intent_id", "method_type", "amount_minor"]
})

CREATE (transaction:Entity {
  name: "payment_transactions",
  label: "Transaction",
  type: "Payment",
  description: "Final, immutable record. Money movement.",
  keyFields: ["id", "payment_intent_id", "processor_id", "amount_minor", "status", "settled_at"],
  immutabilityNote: "Never change. Refunds create new records."
})

CREATE (refund:Entity {
  name: "payment_refunds",
  label: "Refund",
  type: "Payment",
  description: "Reversal of transaction. Partial or full.",
  keyFields: ["id", "transaction_id", "amount_minor", "reason", "status"]
})

CREATE (user)-[:HAS_METHODS {type: "1:N"}]->(paymentMethod)
CREATE (booking)-[:REQUIRES_PAYMENT {type: "1:N"}]->(paymentIntent)
CREATE (paymentIntent)-[:USES_TENDER {type: "1:N"}]->(tender)
CREATE (tender)-[:USES_METHOD {type: "N:1"}]->(paymentMethod)
CREATE (paymentIntent)-[:RESULTS_IN {type: "1:N"}]->(transaction)
CREATE (transaction)-[:REFUNDED_BY {type: "1:N"}]->(refund)
CREATE (biz)-[:RECEIVES_PAYMENTS {type: "1:N"}]->(transaction)

CREATE (d)-[:INCLUDES]->(paymentMethod)
CREATE (d)-[:INCLUDES]->(paymentIntent)
CREATE (d)-[:INCLUDES]->(tender)
CREATE (d)-[:INCLUDES]->(transaction)
CREATE (d)-[:INCLUDES]->(refund);

// ============================================
// QUEUE & WAITLIST DOMAIN
// ============================================

MATCH (d:Domain {name: "Queue & Waitlist"})
MATCH (biz:Entity {name: "bizes"})
MATCH (offer:Entity {name: "offers"})
MATCH (user:Entity {name: "users"})

CREATE (queue:Entity {
  name: "queues",
  label: "Queue",
  type: "Queue",
  description: "Virtual waiting line. FIFO, LIFO, priority, or shortest-job.",
  keyFields: ["id", "biz_id", "offer_id", "name", "service_order", "max_active_size", "max_waiting_size"]
})

CREATE (queueEntry:Entity {
  name: "queue_entries",
  label: "Queue Entry",
  type: "Queue",
  description: "Position in line. Status tracks lifecycle.",
  keyFields: ["id", "queue_id", "customer_user_id", "position", "priority", "status (waiting/notified/confirmed/serving/completed/abandoned)"]
})

CREATE (biz)-[:MANAGES {type: "1:N"}]->(queue)
CREATE (offer)-[:HAS_QUEUE {type: "1:1"}]->(queue)
CREATE (queue)-[:CONTAINS {type: "1:N"}]->(queueEntry)
CREATE (user)-[:JOINS {type: "1:N"}]->(queueEntry)

CREATE (d)-[:INCLUDES]->(queue)
CREATE (d)-[:INCLUDES]->(queueEntry);

// ============================================
// SOCIAL & NOTIFICATIONS DOMAIN
// ============================================

MATCH (d:Domain {name: "Social & Notifications"})
MATCH (user:Entity {name: "users"})
MATCH (offer:Entity {name: "offers"})
MATCH (booking:Entity {name: "booking_orders"})
MATCH (queue:Entity {name: "queues"})

CREATE (identity:Entity {
  name: "graph_identities",
  label: "Graph Identity",
  type: "Social",
  description: "Unified identity across biz boundaries. Users + anonymous + external.",
  keyFields: ["id", "identity_type", "external_id"]
})

CREATE (subscription:Entity {
  name: "graph_subject_subscriptions",
  label: "Subject Subscription",
  type: "Social",
  description: "Watch/notify registration. Subscribe to any entity.",
  keyFields: ["id", "subscriber_identity_id", "target_subject_type", "target_subject_id", "subscription_type", "delivery_mode", "preferred_channel"]
})

CREATE (user)-[:HAS_IDENTITY {type: "1:1"}]->(identity)
CREATE (identity)-[:SUBSCRIBES_TO {type: "1:N"}]->(subscription)

// Subscriptions can target any entity (polymorphic)
CREATE (subscription)-[:WATCHES_OFFER {type: "N:1"}]->(offer)
CREATE (subscription)-[:WATCHES_BOOKING {type: "N:1"}]->(booking)
CREATE (subscription)-[:WATCHES_QUEUE {type: "N:1"}]->(queue)

CREATE (d)-[:INCLUDES]->(identity)
CREATE (d)-[:INCLUDES]->(subscription);

// ============================================
// MARKETPLACE & MULTI-BIZ DOMAIN
// ============================================

MATCH (d:Domain {name: "Marketplace & Multi-Biz"})
MATCH (offer:Entity {name: "offers"})
MATCH (biz:Entity {name: "bizes"})

CREATE (listing:Entity {
  name: "marketplace_listings",
  label: "Marketplace Listing",
  type: "Marketplace",
  description: "Cross-biz discovery. One offer, listed on multiple bizes.",
  keyFields: ["id", "offer_id", "host_biz_id", "listing_biz_id", "commission_rate", "status"]
})

CREATE (referral:Entity {
  name: "referral_attribution",
  label: "Referral Attribution",
  type: "Marketplace",
  description: "Referral tracking. UTM, codes, attribution chains.",
  keyFields: ["id", "referrer_identity_id", "referred_identity_id", "referral_code", "attribution_chain"]
})

CREATE (offer)-[:LISTED_AS {type: "1:N"}]->(listing)
CREATE (biz)-[:LISTS {type: "1:N"}]->(listing)
CREATE (listing)-[:LISTED_ON {type: "N:1"}]->(biz)

CREATE (d)-[:INCLUDES]->(listing)
CREATE (d)-[:INCLUDES]->(referral);

// ============================================
// ENTERPRISE & B2B DOMAIN
// ============================================

MATCH (d:Domain {name: "Enterprise & B2B"})
MATCH (biz:Entity {name: "bizes"})
MATCH (group:Entity {name: "group_accounts"})
MATCH (offer:Entity {name: "offers"})

CREATE (contractRate:Entity {
  name: "enterprise_contract_rates",
  label: "Contract Rate",
  type: "Enterprise",
  description: "Negotiated pricing per company. B2B contracts.",
  keyFields: ["id", "biz_id", "group_account_id", "offer_id", "discount_percent", "flat_rate_minor"]
})

CREATE (payerEligibility:Entity {
  name: "payer_eligibility",
  label: "Payer Eligibility",
  type: "Enterprise",
  description: "Who can bill to company account. Employee eligibility.",
  keyFields: ["id", "group_account_id", "user_id", "spending_limit_minor", "approval_required_above"]
})

CREATE (sla:Entity {
  name: "sla",
  label: "SLA",
  type: "Enterprise",
  description: "Service Level Agreement. Response time, uptime, penalties.",
  keyFields: ["id", "biz_id", "name", "response_time_min", "resolution_time_min", "uptime_percent"]
})

CREATE (biz)-[:HAS_CONTRACT {type: "1:N"}]->(contractRate)
CREATE (group)-[:HAS_PAYER_ELIGIBILITY {type: "1:N"}]->(payerEligibility)
CREATE (offer)-[:HAS_CONTRACT_RATES {type: "1:N"}]->(contractRate)
CREATE (biz)-[:HAS_SLA {type: "1:N"}]->(sla)

CREATE (d)-[:INCLUDES]->(contractRate)
CREATE (d)-[:INCLUDES]->(payerEligibility)
CREATE (d)-[:INCLUDES]->(sla);

// ============================================
// GOVERNANCE & COMPLIANCE DOMAIN
// ============================================

MATCH (d:Domain {name: "Governance & Compliance"})
MATCH (biz:Entity {name: "bizes"})

CREATE (dataResidency:Entity {
  name: "governance_data_residency",
  label: "Data Residency",
  type: "Governance",
  description: "Where data lives. GDPR, data sovereignty.",
  keyFields: ["id", "biz_id", "region", "storage_location", "compliance_framework"]
})

CREATE (consent:Entity {
  name: "governance_consent",
  label: "Consent Management",
  type: "Governance",
  description: "GDPR/CCPA consent tracking. Opt-in/opt-out with audit trail.",
  keyFields: ["id", "user_id", "consent_type", "granted", "granted_at", "withdrawn_at"]
})

CREATE (hipaa:Entity {
  name: "hipaa_access_logs",
  label: "HIPAA Access Log",
  type: "Governance",
  description: "Healthcare compliance. PHI access logging.",
  keyFields: ["id", "user_id", "patient_id", "access_type", "accessed_at", "justification"]
})

CREATE (audit:Entity {
  name: "audit_logs",
  label: "Audit Log",
  type: "Governance",
  description: "Who did what when. Immutable activity log.",
  keyFields: ["id", "biz_id", "actor_id", "action", "entity_type", "entity_id", "changed_fields", "timestamp"]
})

CREATE (biz)-[:HAS_RESIDENCY {type: "1:N"}]->(dataResidency)
CREATE (biz)-[:HAS_AUDIT_LOGS {type: "1:N"}]->(audit)

CREATE (d)-[:INCLUDES]->(dataResidency)
CREATE (d)-[:INCLUDES]->(consent)
CREATE (d)-[:INCLUDES]->(hipaa)
CREATE (d)-[:INCLUDES]->(audit);

// ============================================
// VISUAL LAYOUT HELPERS
// ============================================

// Create visual flow nodes to guide the eye
CREATE (customer:FlowNode {label: "Customer", icon: "👤", layer: "top"})
CREATE (discovery:FlowNode {label: "Discovery", icon: "🔍", layer: "top"})
CREATE (booking:FlowNode {label: "Booking", icon: "📅", layer: "middle"})
CREATE (fulfillment:FlowNode {label: "Fulfillment", icon: "✅", layer: "middle"})
CREATE (payment:FlowNode {label: "Payment", icon: "💳", layer: "bottom"})

// Connect flow nodes
CREATE (customer)-[:FLOWS_TO]->(discovery)
CREATE (discovery)-[:FLOWS_TO]->(booking)
CREATE (booking)-[:FLOWS_TO]->(fulfillment)
CREATE (fulfillment)-[:FLOWS_TO]->(payment);

// ============================================
// INDICES FOR PERFORMANCE
// ============================================

CREATE INDEX entity_name_idx FOR (e:Entity) ON (e.name);
CREATE INDEX entity_type_idx FOR (e:Entity) ON (e.type);
CREATE INDEX domain_name_idx FOR (d:Domain) ON (d.name);

// ============================================
// COMPLETION
// ============================================

RETURN "✅ Bizing Schema Graph Created Successfully!" as status,
       count{(d:Domain)} as domains,
       count{(e:Entity)} as entities,
       count{(r)} as relationships;
