# Bizing DB Schema
tags: #schema #database #drizzle #bizing #booking-system

## Purpose
This document explains how the full schema in `bizing/packages/db/src/schema` works, why each domain exists, and how tables connect.

Primary goals:
- Support very simple booking setups with minimal UI.
- Support advanced workflows (dispatch, multi-resource, memberships, recurring, waitlists, pricing rules, fees, Stripe).
- Stay generic across many business types with configurable templates/dictionaries.

## Global Conventions
tags: #conventions #architecture

- IDs: all primary keys use text ULIDs from shared helpers (`id`, `idWithTag`, `idRef`).
- Tenant boundary: almost every business table has `biz_id`.
- Location scoping: many templates and resources allow optional `location_id` override.
- Audit style: modern tables use `withAuditRefs(() => users.id)` for `created_at/updated_at/deleted_at` + `created_by/updated_by/deleted_by`.
- Configurable dictionaries first: tags, categories, amenities, statuses, specialties are template tables, then assignment/join tables.

## Domain Map
tags: #domains #map

- Tenant and identity: [[SCHEMA#Tenant + Identity]]
- People and grouping: [[SCHEMA#Shared Accounts + Membership]]
- Catalog and bookable resources: [[SCHEMA#Catalog + Inventory + Bookables]]
- Scheduling and availability: [[SCHEMA#Scheduling]]
- Pricing and fees: [[SCHEMA#Pricing]]
- Booking execution: [[SCHEMA#Bookings + Flows]]
- Commerce and money: [[SCHEMA#Commerce + Payments + Stripe]]
- Packages/programs/memberships: [[SCHEMA#Offerings]]
- Reliability and ops: [[SCHEMA#Operations]]

## Tenant + Identity
tags: #tenant #auth #identity

### Table: `bizes`
- Root tenant/org record.
- Referenced by almost every business table.

### Table: `users`
- Canonical user profile for staff, hosts, and customers.
- Referenced by auth tables, memberships, booking actors, and audit refs.

### Table: `sessions`
- Better-auth session records.

### Table: `accounts`
- Better-auth identity provider accounts (OAuth/password/provider linkage).

### Table: `verifications`
- Better-auth verification tokens/challenges.

### Table: `members`
- Better-auth organization membership records.

### Table: `invitations`
- Better-auth invitation workflow records.

## Shared Accounts + Membership
tags: #accounts #memberships #rbac

### Table: `group_accounts`
- Group account abstraction (family/company/group style use cases).

### Table: `group_account_members`
- Membership rows inside a shared account.
- Used for delegation and group bookings.

### Table: `org_memberships`
- Biz membership/role table for access control (`owner/admin/manager/staff/host/customer` patterns).

### Table: `org_membership_locations`
- Location-level scope for a membership.
- Enables staff permissions per branch.

## Catalog + Inventory + Bookables
tags: #catalog #resources #bookables

### Services

#### Table: `services`
- Core “what can be booked” definition.
- Holds duration model, capacity, pricing baseline, policy JSON, visibility.
- Referenced by pricing, bookings, offerings, and availability rules.

### Products

#### Table: `products`
- Retail/catalog items tied to order items.
- Separate from services so mixed commerce works.

### Assets (merged in `assets.ts`)

#### Table: `asset_categories`
- Biz-level category dictionary for assets.

#### Table: `asset_status_definitions`
- Configurable statuses for assets (`biz_id` + optional `location_id` scope).

#### Table: `assets`
- Tangible resources/equipment inventory.
- Can map to `bookables.asset_id`.

#### Table: `asset_tag_templates`
- Configurable tag dictionary for assets.

#### Table: `asset_tag_assignments`
- Asset-to-tag template join.

#### Table: `asset_status_definition_tag_scopes`
- Optional constraints: which statuses are valid for each asset tag template.

### Venues

#### Table: `venue_categories`
- Category dictionary for venues (same pattern as asset categories).

#### Table: `venue_status_definitions`
- Configurable status dictionary for venues at biz/location scope.

#### Table: `venues`
- Space inventory (rooms/halls/event spaces).
- Has `status_definition_id`, `category_id`, capacity and overlap settings.

#### Table: `venue_tag_templates`
- Configurable tag dictionary for venues.

#### Table: `venue_tag_assignments`
- Venue-to-tag template join.

#### Table: `venue_amenity_templates`
- Configurable amenity dictionary for venues.

#### Table: `venue_amenity_assignments`
- Venue-to-amenity template join.

### Bookables (polymorphic resource layer)

#### Table: `bookable_status_definitions`
- Configurable statuses for bookables at biz/location scope.

#### Table: `bookables`
- Unified schedulable resource abstraction.
- Can point to host user, company host account, asset, or venue.
- This is the central table for generic resource assignment logic.

#### Table: `host_users`
- Human host details linked to a `bookable`.

#### Table: `host_specialty_templates`
- Biz-wide configurable specialty dictionary.

#### Table: `host_profile_specialties`
- FK join: host profile to specialty templates.

#### Table: `host_groups`
- Company-as-host dispatch profile.

#### Table: `company_host_profile_members`
- FK join to users for generic company team pool members.
- Replaces freeform technician pool JSON.

## Scheduling
tags: #scheduling #availability #calendar

### Table: `schedules`
- Reusable schedule payload container (generic config JSON).

### Table: `calendars`
- Calendar model for bookables/locations.
- Contains timezone, slot duration/interval, buffers, advance window constraints.

### Table: `availability_rules`
- Unified availability table (replaces old weekly/exceptions/blocked split).
- Supports:
- `mode`: recurring/date_range/timestamp_range
- `frequency`: daily/weekly/monthly/yearly/rrule style
- `effect`: available/unavailable/override_hours/special_pricing
- local-time and exact timestamp windows
- priority and override behavior
- optional pricing context

## Pricing
tags: #pricing #fees #surcharge

### Table: `pricing_rules`
- Rule engine rows for base override, day/time/date/holiday/manual logic.
- Can apply as base, discount, surcharge, call fee, booking fee, after-hours, emergency fee.

### Table: `fee_policies`
- Policy-driven fee definitions and triggers (`on_arrival`, `on_no_show`, etc.).
- Covers call-fee/callout patterns and configurable surcharge scenarios.

### Table: `holiday_calendars`
- Holiday reference dataset for pricing and availability logic.

## Bookings + Flows
tags: #bookings #reservations #waitlist #recurring

### Core booking execution

#### Table: `bookings`
- Main booking row: lifecycle, service, customer, scheduling window, payment summary pointers.

#### Table: `booking_participants`
- Participant-level status for group/party bookings.

#### Table: `booking_assignments`
- Assigned resources (bookables/users/assets/venues) and assignment status.

#### Table: `booking_segments`
- Multi-leg bookings (in-person/virtual/phone segments).

#### Table: `booking_notes`
- Public/private/system notes.

#### Table: `booking_fees`
- Fees actually applied to a booking from policies/manual actions.

#### Table: `booking_events`
- Timeline/events log for booking state transitions and automation hooks.

#### Table: `booking_transfers`
- Transfer history for reassignment/reschedule routing.

#### Table: `booking_followups`
- Follow-up tasks/reminders attached to bookings.

### Flow orchestration

#### Table: `reservations`
- Temporary hold/pre-booking reservation rows.

#### Table: `waitlist_entries`
- Queue/race waitlist state for oversubscribed slots.

#### Table: `recurring_booking_rules`
- Recurring booking template/rule definitions.

#### Table: `recurring_booking_occurrences`
- Materialized/scheduled occurrences from recurring rules.

## Commerce + Payments + Stripe
tags: #commerce #payments #stripe

### Commerce

#### Table: `orders`
- Commercial order container across services/products/fees.

#### Table: `order_items`
- Per-line item for services/products/fees/taxes.

### Internal payment ledger

#### Table: `payment_intents`
- Provider-intent mirror and state.

#### Table: `payment_transactions`
- Authorize/capture/refund/void/etc transaction records.

#### Table: `payment_allocations`
- Split allocation mapping by source and target component.

#### Table: `payment_disputes`
- Dispute lifecycle tracking.

### Stripe integration

#### Table: `stripe_accounts`
- Connected account metadata and mapping.

#### Table: `stripe_customers`
- Stripe customer mapping to internal entities.

#### Table: `stripe_payment_methods`
- Stored Stripe payment method metadata and linkage.

#### Table: `stripe_setup_intents`
- Setup intent synchronization.

#### Table: `stripe_checkout_sessions`
- Checkout session tracking.

#### Table: `stripe_invoices`
- Invoice synchronization for billing and reconciliation.

#### Table: `stripe_webhook_events`
- Webhook inbox for idempotent processing.

#### Table: `stripe_payouts`
- Payout records for connected-account cash movement.

#### Table: `stripe_transfers`
- Transfer records between Stripe balances/accounts.

## Offerings
tags: #programs #packages #memberships

### Programs

#### Table: `programs`
- Multi-session program definition.

#### Table: `program_sessions`
- Program session schedule instances.

#### Table: `program_enrollments`
- Enrollment lifecycle per participant.

#### Table: `program_attendance`
- Session-level attendance.

### Packages

#### Table: `packages`
- Package product definition.

#### Table: `package_items`
- What a package includes/entitles.

#### Table: `package_wallets`
- Customer package balance/wallet.

#### Table: `package_ledger_entries`
- Immutable movements against package wallets.

### Memberships

#### Table: `memberships`
- Membership plan definition.

#### Table: `membership_subscriptions`
- Active/trialing/past_due/cancelled subscription state.

#### Table: `membership_usage_entries`
- Consumption ledger for membership entitlements.

## Operations
tags: #ops #audit #reliability #integration

### Table: `idempotency_keys`
- Prevents duplicate command processing for critical APIs.

### Table: `audit_events`
- High-level audit/event records for traceability.

### Table: `outbox_events`
- Transactional outbox for reliable async integration delivery.

### Table: `consent_records`
- Consent/legal acceptance records.

### Table: `incident_batches`
- Grouped operational incidents.

### Table: `incident_booking_actions`
- Booking-specific remediation actions linked to incidents.

### Table: `external_channels`
- External integration channel definitions.

### Table: `external_sync_events`
- Sync event log per external channel.

## Enums and State Machines
tags: #enums #state-machine

`enums.ts` centralizes all status vocabularies and keeps API + DB contracts aligned:
- tenant/account roles
- bookable/resource state
- booking lifecycle and assignment state
- reservation/waitlist state
- pricing/fee categories and triggers
- payment and dispute state
- package/membership state
- outbox/idempotency reliability state

## Typical End-to-End Flows
tags: #flows #how-it-works

### Simple single-resource booking
- Create `biz` + `location`.
- Create `service`.
- Create `venue` or `asset`.
- Create `bookable` linked to that resource.
- Add `calendar` + `availability_rules`.
- Booking API writes `bookings` and `booking_assignments`.

### Dispatch business with call fees
- Model company host as `bookable(type=company_host)` + `company_host_profile`.
- Add pool members in `company_host_profile_members`.
- Configure fee policy for callout/arrival fee in `fee_policies`.
- At booking/arrival events, apply fees into `booking_fees` and `order_items`.

### Membership/package assisted booking
- Define `memberships` or `packages`.
- Track balances in `membership_usage_entries` or `package_wallets` + `package_ledger_entries`.
- Booking completion consumes entitlement entries.

### Payment and reconciliation
- Create internal `payment_intents` + `payment_transactions`.
- Map provider objects in Stripe tables.
- Keep webhooks idempotent in `stripe_webhook_events`.
- Reflect final allocations in `payment_allocations`.

## Design Principles Embedded in This Schema
tags: #principles #scalability

- Configurable templates over freeform strings.
- Join tables over embedded arrays when referential integrity matters.
- Biz/location scoping for multi-tenant flexibility.
- Generic core (`bookables`, `availability_rules`) with specialized extension tables.
- Rich auditability and operational recovery (`audit_events`, `outbox_events`, idempotency).

## Where to Edit What
tags: #maintenance #editing

- New resource taxonomy/status/tag logic:
- edit `assets.ts`, `venues.ts`, `bookables.ts`
- New scheduling semantics:
- edit `scheduling.ts` + `enums.ts`
- New pricing/fee behavior:
- edit `pricing.ts` + booking fee handling in `bookings.ts`
- New payment provider details:
- edit `payments.ts`, `stripe.ts`
- New lifecycle/status values:
- edit `enums.ts` first, then consuming tables and APIs
