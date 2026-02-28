# THE ULTIMATE BIZING SCHEMA BIBLE
## Complete Guide to the Booking Platform Architecture

> **Explain Like I'm 5 (ELI5) Edition**  
> **479 Tables | 8,778 Fields | 515 Relationships | 100+ Use Cases**

---

## 📚 TABLE OF CONTENTS

1. [The Big Picture](#the-big-picture)
2. [Core Concepts (ELI5)](#core-concepts-eli5)
3. [Architecture Philosophy](#architecture-philosophy)
4. [Domain-by-Domain Breakdown](#domain-by-domain-breakdown)
5. [Use Case Mapping](#use-case-mapping)
6. [Data Flow Examples](#data-flow-examples)
7. [Relationship Patterns](#relationship-patterns)
8. [Query Cookbook](#query-cookbook)

---

## THE BIG PICTURE

### What is Bizing?

**Bizing = Business in Action.** It's a platform where:
- **Service providers** (salons, doctors, consultants) offer appointments
- **Customers** book time slots
- **Money** flows securely
- **Resources** (people, rooms, equipment) get scheduled
- **Queues** manage waitlists
- **Enterprises** handle complex B2B contracts

### The Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│  CUSTOMER-FACING LAYER                  │
│  - Browse offers                        │
│  - Book appointments                    │
│  - Pay money                            │
│  - Join queues                          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  BUSINESS LOGIC LAYER                   │
│  - Availability calculation             │
│  - Pricing rules                        │
│  - Resource assignment                  │
│  - Payment processing                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  DATA LAYER (This Schema)               │
│  - 479 tables                           │
│  - Tenant isolation                     │
│  - Audit trails                         │
│  - Relationships                        │
└─────────────────────────────────────────┘
```

---

## CORE CONCEPTS (ELI5)

### 1. **The Biz (Tenant)**
**What:** Think of this like an apartment building. Each business gets their own "apartment" (tenant) where all their data lives.

**Why it matters:** Sarah's Salon can't see data from Mike's Barbershop. Complete separation.

**Tables:**
- `bizes` - The root tenant record
- `bizConfigSets` - Settings like "how far ahead can people book"
- `bizConfigValues` - Actual values like "7 days"

**Use Cases:**
- UC-01: Simple appointment booking
- UC-40: Sarah's solo entrepreneur setup
- UC-99: Multi-location business

---

### 2. **Users & Memberships**
**What:** People who use the system. A user can be:
- **Owner** (runs the business)
- **Staff** (works there)
- **Customer** (books appointments)

**Key insight:** The same person can be a customer at one biz and staff at another!

**Tables:**
- `users` - Identity (email, name, phone)
- `memberships` - "User X is Staff at Business Y"
- `groupAccounts` - Families or companies booking together

**Relationships:**
```
users --memberships--> bizes (what role?)
users --belongsTo--> groupAccounts (family/company)
```

**Use Cases:**
- UC-10: Family booking (group account)
- UC-25: Corporate accounts
- UC-42: Staff scheduling

---

### 3. **Offers: Shell vs Version**
**This is THE most important concept.**

**ELI5 Analogy:** Think of a menu at a restaurant.

- **Offer (Shell)** = "We sell haircuts" (the menu item)
- **Offer Version** = "Haircut v2: 50 minutes, $75, available Tuesday-Thursday" (the recipe)

**Why two tables?**
- Menu item stays the same (stable URL, reviews)
- Recipe can change (new price, new duration)
- Old bookings still reference old recipe ("I booked when it was $60")

**Tables:**
- `offers` - The shell (name, slug, execution mode)
- `offerVersions` - The frozen recipe (pricing, duration, policies)
- `offerComponents` - Bundles (haircut + shampoo + style)

**Execution Modes:**
- `slot` - Pick a time (standard appointment)
- `queue` - Join a line (walk-in waitlist)
- `request` - Ask first, approve later (complex services)
- `auction` - Bid for time (high-demand slots)
- `async` - Submit request, get result later (document review)
- `route_trip` - Transportation scheduling
- `open_access` - No specific time needed
- `itinerary` - Multi-step experience

**Use Cases:**
- UC-01: Simple slot booking
- UC-07: Walk-in queue
- UC-15: Request-based approval
- UC-31: Auction for limited slots

---

### 4. **Resources (The Supply Side)**
**What:** Anything that provides service:
- **Host** = Person (stylist, doctor, consultant)
- **Asset** = Thing (massage table, VR headset, equipment)
- **Venue** = Place (room, studio, office)

**Key insight:** All resources have **calendars** and can be **scheduled**.

**Tables:**
- `resources` - Polymorphic table (host/asset/venue)
- `calendars` - Each resource has one
- `availabilityRules` - "Open 9-5 weekdays"
- `availabilityBlocks` - "Booked 2-3pm Tuesday"

**Availability Rule Precedence:** (Top wins)
1. `timestamp_range` - "Blocked 2:00-2:50 on March 15"
2. `date_range` - "Closed Christmas Day"
3. `recurring` - "Open 9-5 Monday-Friday"
4. `default_mode` - "Closed unless opened by rules"

**Use Cases:**
- UC-03: Multiple staff members
- UC-12: Room booking
- UC-18: Equipment rental

---

### 5. **Booking Orders (The Commitment)**
**What:** When a customer says "I want this" and pays (or promises to pay).

**Critical concept:** Booking orders contain **snapshots**.

**ELI5:** When you buy something, you get a receipt. Even if the store changes prices later, your receipt shows what you paid. Same here!

**What's snapshotted:**
- `pricingSnapshot` - Price at time of booking
- `policySnapshot` - Cancellation rules at that moment
- `offerVersionId` - Which recipe was used

**Tables:**
- `bookingOrders` - The main order
- `bookingOrderLines` - Line items (main service + add-ons)
- `fulfillmentUnits` - The actual "who does what when"

**Order Status Flow:**
```
draft → pending → confirmed → completed
   ↓       ↓         ↓
cancelled cancelled  no_show
```

**Use Cases:**
- UC-01: Basic booking
- UC-05: Multi-service booking
- UC-20: Recurring appointments

---

### 6. **Fulfillment Units (The Atomic Delivery)**
**What:** The smallest schedulable piece.

**ELI5:** You booked a "Spa Day" (booking order). The fulfillment units are:
- 9:00 AM: Massage with Sarah (fulfillment unit 1)
- 10:30 AM: Facial with Mike (fulfillment unit 2)
- 12:00 PM: Lunch (fulfillment unit 3)

**Tables:**
- `fulfillmentUnits` - One row per "who/what/when"
- Links to: resource (who), booking line (what), time (when)

**Use Cases:**
- UC-22: Multi-staff appointments
- UC-38: Sequential services

---

### 7. **Payments (The Money Flow)**
**The Payment State Machine:**
```
Created → Requires Action → Processing → Succeeded
   ↓           ↓              ↓
Cancelled    Failed         Refunded
```

**Key Tables:**
- `paymentIntents` - "I intend to pay $100" (holds funds)
- `paymentIntentTenders` - "I'll pay $60 with card, $40 with points"
- `paymentTransactions` - Final, immutable record
- `paymentRefunds` - When money goes back

**Immutable Records:** Once a transaction succeeds, it's NEVER changed. Refunds create new records.

**Use Cases:**
- UC-01: Simple payment
- UC-11: Split payment
- UC-35: Refunds and cancellations

---

### 8. **Queues (Virtual Waiting Lines)**
**What:** When you can't book a specific time, you join a line.

**Real-world examples:**
- Restaurant waitlist
- DMV line
- Walk-in clinic

**Key Concepts:**
- `serviceOrder`: fifo (first-in-first-out), lifo, priority, shortest-job
- `maxActiveSize`: How many being served now
- `maxWaitingSize`: How many can wait

**Tables:**
- `queues` - The line definition
- `queueEntries` - People in line with position numbers

**Queue Entry Lifecycle:**
```
waiting → notified → confirmed → serving → completed
   ↓          ↓          ↓
abandoned  expired    cancelled
```

**Use Cases:**
- UC-07: Restaurant waitlist
- UC-19: Urgent care triage
- UC-43: Priority queue for VIPs

---

### 9. **Standing Reservations (Recurring Bookings)**
**What:** "Every Tuesday at 2 PM for the next 6 months"

**Tables:**
- `standingReservationContracts` - The agreement
- `standingReservationOccurrences` - Each individual instance

**How it works:**
1. Contract says: "Weekly, Tuesdays, 2 PM, 50 minutes"
2. System generates occurrences for next 60 days
3. Each occurrence can become a real booking
4. Exceptions handled (skip, reschedule)

**Use Cases:**
- UC-08: Weekly therapy
- UC-21: Recurring cleaning service
- UC-44: Monthly maintenance

---

### 10. **Social Graph (Notifications & Subscriptions)**
**What:** The "watch" system.

**Real-world examples:**
- "Notify me when Dr. Smith has openings"
- "Alert me when this item goes on sale"
- "Tell me when my table is ready"

**Tables:**
- `graphIdentities` - Unified identity across businesses
- `subjectSubscriptions` - "I want to watch X"
- `graphSubjectSubscriptions` - The actual subscription record

**Subject Types:**
- `offer` - Watch a service
- `booking` - Watch your appointment
- `queue` - Watch your position
- `location` - Watch a branch

**Use Cases:**
- UC-09: Waitlist notifications
- UC-27: Price drop alerts
- UC-45: Appointment reminders

---

## DOMAIN-BY-DOMAIN BREAKDOWN

### DOMAIN 1: IDENTITY & ACCESS (40 tables)
**Purpose:** Who are you and what can you do?

**Core Tables:**

#### `bizes` - The Root Tenant
**Fields:**
- `id` - ULID primary key
- `name` - "Sarah's Salon"
- `slug` - URL-friendly "sarahs-salon"
- `type` - individual | small_business | enterprise
- `timezone` - America/Los_Angeles
- `currency` - USD
- `status` - active | draft | inactive | archived
- `metadata` - JSONB for custom settings

**Relationships:**
- `bizes` → `memberships` (who works here)
- `bizes` → `locations` (where they operate)
- `bizes` → `offers` (what they sell)
- `bizes` → EVERYTHING (tenant isolation)

**Use Cases:**
- UC-01: Single location business
- UC-99: Multi-location franchise
- UC-100: Enterprise with sub-brands

---

#### `users` - People
**Fields:**
- `id` - ULID
- `email` - Login identifier
- `name` - Display name
- `phone` - Optional
- `emailVerified` - Boolean
- `image` - Avatar URL

**Relationships:**
- `users` → `memberships` (which businesses)
- `users` → `bookingOrders` (what they booked)
- `users` → `paymentMethods` (saved cards)
- `users` → `groupAccounts` (family/company)

**Use Cases:**
- UC-01: Customer registration
- UC-40: Guest checkout
- UC-42: Staff login

---

#### `memberships` - Business Relationships
**What:** "User X has Role Y at Business Z"

**Fields:**
- `id` - ULID
- `userId` - Who
- `bizId` - Where
- `role` - owner | admin | manager | staff | host | customer
- `status` - active | inactive

**Relationships:**
- Links `users` to `bizes`
- Role determines permissions

**Use Cases:**
- UC-02: Staff scheduling
- UC-36: Role-based access
- UC-50: Owner delegation

---

#### `groupAccounts` - Shared Accounts
**What:** Families, couples, or companies that book together.

**Fields:**
- `id` - ULID
- `bizId` - Which business
- `type` - family | company | group
- `name` - "The Johnson Family"

**Relationships:**
- `groupAccounts` → `memberships` (who's in the group)
- `groupAccounts` → `bookingOrders` (group bookings)

**Use Cases:**
- UC-10: Family spa day
- UC-25: Corporate bookings
- UC-48: Wedding party

---

#### `authz` - Authorization Matrix
**What:** Who can do what where.

**Pattern:** Role + Permission + Scope + Effect

**Example:**
- Role: `manager`
- Permission: `booking:cancel`
- Scope: `location` (which location)
- ScopeId: `loc_xxx`
- Effect: `allow` | `deny`

**Deny overrides allow** - You can explicitly block sensitive actions.

**Use Cases:**
- UC-36: Manager permissions
- UC-52: Location-specific access
- UC-67: Audit and compliance

---

### DOMAIN 2: CATALOG & COMMERCE (48 tables)
**Purpose:** What are you selling?

#### `offers` - The Product Shell
**Fields:**
- `id` - ULID
- `bizId` - Which business
- `name` - "Deluxe Haircut"
- `slug` - URL: /book/deluxe-haircut
- `executionMode` - CRITICAL FIELD
  - `slot` = Pick a time
  - `queue` = Join a line
  - `request` = Ask first
  - `auction` = Bid
  - `async` = Submit and wait
  - `route_trip` = Transportation
  - `open_access` = No time needed
  - `itinerary` = Multi-step
- `status` - draft | active | inactive | archived
- `isPublished` - Show in storefront?

**Relationships:**
- `offers` → `offerVersions` (all versions over time)
- `offers` → `demandPricing` (dynamic pricing rules)
- `offers` → `queues` (if execution_mode = queue)

**Use Cases:**
- UC-01: Standard appointment
- UC-07: Walk-in queue
- UC-15: Request-based service
- UC-31: Auction for limited slots

---

#### `offerVersions` - The Frozen Recipe
**CRITICAL:** Immutable once published!

**Fields:**
- `id` - ULID
- `offerId` - Parent shell
- `version` - 1, 2, 3...
- `status` - draft | published | retired | archived
- `publishAt` - When it goes live
- `retireAt` - When it stops being bookable

**The Four Models:**

**1. Duration Model:**
- `durationMode` - fixed | variable | range
- `defaultDurationMin` - 50 minutes
- `minDurationMin` - 30 (for variable)
- `maxDurationMin` - 90 (for variable)
- `durationStepMin` - 15 (increments)

**2. Pricing Model (JSONB):**
```json
{
  "basePriceMinor": 15000,
  "currency": "USD",
  "surgeEnabled": true,
  "tieredPricing": {
    "bronze": 15000,
    "silver": 13500,
    "gold": 12000
  }
}
```

**3. Capacity Model (JSONB):**
```json
{
  "mode": "single|group|resource_constrained",
  "maxParticipants": 1,
  "resourcesRequired": ["stylist", "chair"]
}
```

**4. Policy Model (JSONB):**
```json
{
  "cancellation": {
    "windowHours": 24,
    "feePercent": 50
  },
  "rescheduling": {
    "allowed": true,
    "maxTimes": 2
  },
  "noShow": {
    "penalty": "charge_full"
  }
}
```

**Slot Visibility (Critical for UC-40):**
```json
{
  "slotVisibility": {
    "defaultVisibleSlotCount": 3,
    "defaultAdvanceDays": 7,
    "tierOverrides": {
      "vip": {
        "visibleSlotCount": 10,
        "advanceDays": 30
      },
      "loyalty": {
        "visibleSlotCount": 5,
        "advanceDays": 14
      }
    }
  }
}
```

**Relationships:**
- `offerVersions` → `offerComponents` (bundled items)
- `offerVersions` → `bookingOrders` (bookings use this version)
- `offerVersions` → `resources` (which resources can fulfill)

**Use Cases:**
- UC-40: Tier-based visibility (3 slots default, 10 for VIP)
- UC-55: Version history
- UC-62: Policy changes over time

---

#### `offerComponents` - Bundles & Add-ons
**What:** Complex offers made of parts.

**Types:**
- `fixed` - Always included (haircut + shampoo)
- `optional` - Can add on (deep conditioning +$20)
- `choice` - Pick one (aroma: lavender | eucalyptus | unscented)

**Fields:**
- `id` - ULID
- `offerVersionId` - Which version
- `componentType` - fixed | optional | choice
- `required` - Boolean
- `pricing` - Additional cost (or included)

**Use Cases:**
- UC-05: Spa package (massage + facial + lunch)
- UC-14: À la carte options
- UC-33: Tiered packages

---

### DOMAIN 3: SUPPLY & RESOURCES (50 tables)
**Purpose:** Who/what provides the service?

#### `resources` - Polymorphic Supply
**The Magic:** One table for hosts, assets, and venues.

**Fields:**
- `id` - ULID
- `bizId` - Which business
- `type` - host | company_host | asset | venue
- `name` - "Sarah" | "Chair 3" | "Room A"
- `status` - active | inactive | maintenance | retired
- `calendarId` - Links to availability

**Resource Types:**

**Host** = Person who provides service
- Stylist, doctor, consultant, trainer
- Has skills, ratings, bio

**CompanyHost** = Business unit
- "Dr. Smith's Team" (any available team member)
- "East Wing Stylists"

**Asset** = Equipment
- Massage table, VR headset, diagnostic machine
- Can be reserved

**Venue** = Physical space
- Room, studio, office, treatment room
- Has capacity, amenities

**Relationships:**
- `resources` → `calendars` (availability)
- `resources` → `fulfillmentUnits` (assigned to bookings)
- `resources` → `offerVersions` (can fulfill these offers)

**Use Cases:**
- UC-03: Book specific stylist
- UC-12: Reserve a room
- UC-18: Equipment rental
- UC-46: Team-based assignment

---

#### `calendars` - Time Containers
**What:** Every resource has a calendar that defines when it's available.

**Fields:**
- `id` - ULID
- `resourceId` - Which resource
- `timezone` - America/Los_Angeles
- `status` - active | inactive

**Relationships:**
- `calendars` → `availabilityRules` (when open)
- `calendars` → `availabilityBlocks` (when busy)

**Use Cases:**
- UC-04: Staff schedules
- UC-13: Room availability
- UC-24: Holiday hours

---

#### `availabilityRules` - When Available
**Precedence Order** (top wins):

1. **`timestamp_range`** - "Blocked 2:00-2:50 on March 15"
2. **`date_range`** - "Closed Christmas Day"
3. **`recurring`** - "Open 9-5 Monday-Friday"
4. **`default_mode`** - "Closed unless opened"

**Fields:**
- `id` - ULID
- `calendarId` - Which calendar
- `ruleMode` - recurring | date_range | timestamp_range
- `frequency` - none | daily | weekly | monthly | yearly | recurrence_rule
- `outcome` - open | closed
- `rrule` - iCal RRULE string for complex patterns
- `priority` - Higher = evaluated first

**Examples:**

**Weekly Business Hours:**
```json
{
  "ruleMode": "recurring",
  "frequency": "weekly",
  "daysOfWeek": [1, 2, 3, 4, 5], // Mon-Fri
  "timeWindows": [{"start": "09:00", "end": "17:00"}],
  "outcome": "open"
}
```

**Holiday Closure:**
```json
{
  "ruleMode": "date_range",
  "startDate": "2026-12-25",
  "endDate": "2026-12-25",
  "outcome": "closed"
}
```

**Lunch Break:**
```json
{
  "ruleMode": "recurring",
  "frequency": "daily",
  "timeWindows": [{"start": "12:00", "end": "13:00"}],
  "outcome": "closed"
}
```

**Use Cases:**
- UC-04: Staff working hours
- UC-24: Seasonal schedules
- UC-39: Break times

---

#### `availabilityBlocks` - Busy Time
**What:** Actually booked or blocked time.

**Sources:**
- Confirmed bookings
- Manual blocks ("I'm in a meeting")
- Recurring blocked time ("Staff meeting every Monday 8 AM")

**Fields:**
- `id` - ULID
- `resourceId` - Which resource
- `startAt` - 2026-03-15T14:00:00Z
- `endAt` - 2026-03-15T14:50:00Z
- `blockType` - booking | manual | recurring
- `reason` - "Staff meeting"

**Use Cases:**
- UC-01: Prevent double-booking
- UC-16: Block time for tasks
- UC-37: Recurring admin time

---

### DOMAIN 4: BOOKINGS & FULFILLMENT (23 tables)
**Purpose:** The actual appointments and deliveries.

#### `bookingOrders` - Customer Commitment
**The Big One.** This is where money meets time.

**Fields:**

**Identity:**
- `id` - ULID
- `bizId` - Tenant

**Commercial Context (SNAPSHOTS - Immutable!):**
- `offerId` - Which offer shell
- `offerVersionId` - Which frozen recipe (CRITICAL)
- `pricingSnapshot` - JSONB of price breakdown
- `policySnapshot` - JSONB of cancellation rules

**Why snapshots?** So when Sarah books at $60, and the price later goes to $75, Sarah's booking still shows $60. The receipt doesn't change!

**Customer:**
- `customerUserId` - Who booked (optional)
- `customerGroupAccountId` - Family/company (optional)

**Time:**
- `requestedStartAt` - What they asked for
- `confirmedStartAt` - What they got
- `confirmedEndAt` - Calculated from duration

**Money:**
- `subtotalMinor` - Before tax/fees
- `taxMinor` - Sales tax
- `feeMinor` - Booking fees
- `discountMinor` - Coupons/promos
- `totalMinor` - Final amount
- `currency` - USD

**Status:**
- `status` - pending | confirmed | cancelled | completed | no_show

**Relationships:**
- `bookingOrders` → `bookingOrderLines` (line items)
- `bookingOrders` → `paymentIntents` (payment)
- `bookingOrders` → `fulfillmentUnits` (delivery)

**Use Cases:**
- UC-01: Simple booking
- UC-05: Multi-service booking
- UC-35: Cancellation

---

#### `bookingOrderLines` - Line Items
**What:** Individual pieces of an order.

**Types:**
- `primary` - Main service (the haircut)
- `addon` - Extra (deep conditioning)
- `product` - Physical item (take-home shampoo)
- `fee` - Charges (late cancellation fee)

**Fields:**
- `id` - ULID
- `bookingOrderId` - Parent order
- `lineType` - primary | addon | product | fee
- `description` - "Deep Conditioning Treatment"
- `amountMinor` - 2000 ($20.00)

**Use Cases:**
- UC-05: Package deals
- UC-14: Add-ons
- UC-33: Product sales

---

#### `fulfillmentUnits` - Atomic Delivery
**The Smallest Schedulable Unit.**

**Example Booking:**
- Customer books "Spa Day" (booking order)
- Line items: Massage, Facial, Lunch
- Fulfillment units:
  1. Massage at 9 AM with Sarah
  2. Facial at 10:30 AM with Mike
  3. Lunch at 12 PM (no resource assigned)

**Fields:**
- `id` - ULID
- `bookingOrderLineId` - Which line item
- `resourceId` - Who/what delivers (optional)
- `kind` - host_assignment | asset_reservation | venue_booking
- `scheduledStartAt` - 2026-03-15T09:00:00Z
- `scheduledEndAt` - 2026-03-15T09:50:00Z
- `status` - pending | confirmed | in_progress | completed | cancelled

**Relationships:**
- `fulfillmentUnits` → `resources` (who's assigned)
- `fulfillmentUnits` → `locations` (where it happens)

**Use Cases:**
- UC-22: Multi-staff booking
- UC-38: Sequential services
- UC-49: Resource handoff

---

#### `standingReservationContracts` - Recurring Bookings
**What:** "Every Tuesday at 2 PM for 6 months"

**Fields:**
- `id` - ULID
- `customerUserId` - Who
- `offerVersionId` - What service
- `name` - "Weekly Therapy"
- `recurrenceRule` - RRULE format
- `anchorStartAt` - First occurrence
- `effectiveStartDate` - When contract starts
- `effectiveEndDate` - When contract ends (optional)
- `autoCreateOrders` - Generate bookings automatically?
- `status` - draft | active | paused | completed

**RRULE Examples:**

**Every Tuesday:**
```
FREQ=WEEKLY;BYDAY=TU;INTERVAL=1
```

**Every other Friday:**
```
FREQ=WEEKLY;BYDAY=FR;INTERVAL=2
```

**First Monday of month:**
```
FREQ=MONTHLY;BYDAY=1MO
```

**Relationships:**
- `standingReservationContracts` → `standingReservationOccurrences` (generated instances)

**Use Cases:**
- UC-08: Weekly therapy
- UC-21: Bi-weekly cleaning
- UC-44: Monthly maintenance

---

### DOMAIN 5: PAYMENTS & MONEY (15 tables)
**Purpose:** Secure money handling.

#### `paymentIntents` - Checkout Sessions
**The Payment State Machine:**
```
created → requires_action → processing → succeeded
   ↓           ↓              ↓
cancelled    failed         refunded
```

**Fields:**
- `id` - ULID
- `bizId` - Which business
- `bookingOrderId` - What is being paid for
- `customerUserId` - Who's paying
- `amountMinor` - Total to charge
- `currency` - USD
- `status` - Created | requires_action | processing | succeeded | failed | cancelled

**Relationships:**
- `paymentIntents` → `paymentIntentTenders` (how they pay)
- `paymentIntents` → `paymentTransactions` (final result)

**Use Cases:**
- UC-01: Simple payment
- UC-28: 3D Secure (requires_action)
- UC-35: Failed payment retry

---

#### `paymentIntentTenders` - Payment Methods Used
**What:** How the customer pays.

**Examples:**
- $60 on Visa ending in 4242
- $15 in loyalty points
- $45 on card + $15 in points (split)

**Fields:**
- `id` - ULID
- `paymentIntentId` - Parent intent
- `methodType` - card | points | cash | bank_transfer
- `amountMinor` - Portion of total

**Use Cases:**
- UC-11: Split payment
- UC-29: Points redemption
- UC-51: Cash payment

---

#### `paymentTransactions` - Immutable Records
**What:** The final, unchangeable record of money movement.

**CRITICAL:** Never updated! Refunds create new records.

**Fields:**
- `id` - ULID
- `paymentIntentId` - Source intent
- `processorId` - Stripe transaction ID
- `amountMinor` - Amount charged
- `currency` - USD
- `status` - pending | completed | failed
- `settledAt` - When money moved

**Use Cases:**
- UC-01: Successful charge
- UC-35: Refund record
- UC-66: Reconciliation

---

#### `paymentRefunds` - Money Back
**What:** When you return money to the customer.

**Types:**
- `full` - Complete refund
- `partial` - Partial refund

**Fields:**
- `id` - ULID
- `transactionId` - Original transaction
- `amountMinor` - How much refunded
- `reason` - customer_request | service_not_provided | duplicate

**Use Cases:**
- UC-35: Cancellation refund
- UC-53: Partial refund for shortened service

---

### DOMAIN 6: QUEUE & WAITLIST (10 tables)
**Purpose:** Managing walk-ins and waitlists.

#### `queues` - Virtual Lines
**Fields:**
- `id` - ULID
- `bizId` - Which business
- `offerId` - What service (optional)
- `name` - "Walk-in Queue"
- `serviceOrder` - fifo | lifo | priority | shortest_job
- `maxActiveSize` - How many being served now
- `maxWaitingSize` - How many can wait
- `avgServiceTimeMin` - For wait estimates

**Service Disciplines:**
- `fifo` - First in, first out (fair)
- `lifo` - Last in, first out (stack)
- `priority` - VIP first
- `shortest_job` - Quick tasks first

**Relationships:**
- `queues` → `queueEntries` (people in line)
- `queues` → `offers` (if tied to specific service)

**Use Cases:**
- UC-07: Restaurant waitlist
- UC-19: Urgent care triage
- UC-43: Priority queue for VIPs

---

#### `queueEntries` - Positions in Line
**Fields:**
- `id` - ULID
- `queueId` - Which line
- `customerUserId` - Who
- `position` - 1, 2, 3...
- `priority` - Higher = sooner (can jump)
- `estimatedServiceAt` - When they'll be served
- `status` - waiting | notified | confirmed | serving | completed | abandoned

**Lifecycle:**
```
waiting → notified ("Your table is almost ready")
    ↓
confirmed ("I'm on my way")
    ↓
serving (being helped)
    ↓
completed
```

**Use Cases:**
- UC-07: Table ready notifications
- UC-19: Patient triage
- UC-43: VIP priority

---

### DOMAIN 7: SOCIAL & NOTIFICATIONS (25 tables)
**Purpose:** The "watch" and "notify" system.

#### `graphIdentities` - Unified Identity
**What:** One identity across all businesses.

**Types:**
- `registered` - User account
- `anonymous` - Guest checkout
- `phone` - Phone number identity
- `email` - Email-only identity

**Fields:**
- `id` - ULID
- `identityType` - registered | anonymous | phone | email
- `externalId` - Phone number, email, etc.

**Use Cases:**
- UC-40: Guest checkout
- UC-47: Phone-based booking

---

#### `subjectSubscriptions` - The Watch List
**What:** "Tell me when X happens."

**Subscription Types:**
- `watch` - Passive observation
- `notify` - Active notification
- `alert` - Urgent alert

**Delivery Modes:**
- `instant` - Right now
- `batched` - Every 15 minutes
- `digest` - Daily summary

**Channels:**
- `in_app` - In-app notification
- `email` - Email
- `sms` - Text message
- `push` - Push notification

**Fields:**
- `id` - ULID
- `subscriberIdentityId` - Who's watching
- `targetSubjectType` - offer | booking | queue | location
- `targetSubjectId` - What they're watching
- `subscriptionType` - watch | notify | alert
- `deliveryMode` - instant | batched | digest
- `preferredChannel` - in_app | email | sms | push

**Examples:**
- "Notify me when Dr. Smith has openings"
- "Alert me when my table is ready"
- "Email me daily digest of new offers"

**Use Cases:**
- UC-09: Waitlist notifications
- UC-27: Price drop alerts
- UC-45: Appointment reminders

---

### DOMAIN 8: MARKETPLACE & MULTI-BIZ (12 tables)
**Purpose:** Cross-business discovery and referrals.

#### `marketplaceListings` - Cross-Biz Discovery
**What:** One offer, listed on multiple businesses.

**Example:**
- Business A creates "Massage Therapy"
- Business B (spa aggregator) lists it
- Customer finds it on Business B's site
- Booking goes to Business A
- Business B gets commission

**Fields:**
- `id` - ULID
- `offerId` - Source offer
- `hostBizId` - Who owns the offer
- `listingBizId` - Where it's displayed
- `commissionRate` - 0.15 (15%)
- `status` - active | hidden | sold_out

**Use Cases:**
- UC-17: Spa aggregator
- UC-26: Service marketplace
- UC-54: Cross-promotion

---

#### `referralAttribution` - Referral Tracking
**What:** Who referred whom, and when.

**Fields:**
- `id` - ULID
- `referrerIdentityId` - Who referred
- `referredIdentityId` - Who signed up
- `referralCode` - "SARAH20"
- `attributionChain` - Full tracking history

**Use Cases:**
- UC-06: Referral program
- UC-23: Affiliate tracking
- UC-56: Influencer codes

---

### DOMAIN 9: ENTERPRISE & B2B (23 tables)
**Purpose:** Complex business contracts.

#### `enterpriseContractRates` - Negotiated Pricing
**What:** Special pricing for big customers.

**Example:**
- Normal price: $100/hour
- ACME Corp contract: $80/hour (20% discount)

**Fields:**
- `id` - ULID
- `groupAccountId` - Which company
- `offerId` - Which service
- `discountPercent` - 20
- `flatRateMinor` - Optional fixed price

**Use Cases:**
- UC-25: Corporate accounts
- UC-32: Volume discounts
- UC-58: Enterprise contracts

---

#### `payerEligibility` - Who Can Bill to Company
**What:** Employee can charge to company account.

**Fields:**
- `id` - ULID
- `groupAccountId` - Which company
- `userId` - Which employee
- `spendingLimitMinor` - Max per transaction
- `approvalRequiredAbove` - Needs manager approval

**Use Cases:**
- UC-25: Employee benefits
- UC-41: Manager approval flows
- UC-63: Department budgets

---

#### `sla` - Service Level Agreements
**What:** Promises about service quality.

**Fields:**
- `id` - ULID
- `name` - "Enterprise Support"
- `responseTimeMin` - 15
- `resolutionTimeMin` - 240
- `uptimePercent` - 99.9
- `penaltyTerms` - JSONB

**Use Cases:**
- UC-30: SLA tracking
- UC-59: Enterprise support

---

### DOMAIN 10: GOVERNANCE & COMPLIANCE (21 tables)
**Purpose:** Legal, audit, and data protection.

#### `governanceDataResidency` - Where Data Lives
**What:** GDPR, data sovereignty.

**Fields:**
- `id` - ULID
- `bizId` - Which business
- `region` - EU | US | APAC
- `storageLocation` - Specific data center
- `complianceFramework` - GDPR | CCPA | HIPAA

**Use Cases:**
- UC-34: GDPR compliance
- UC-60: Data localization

---

#### `governanceConsent` - Permission Tracking
**What:** Did user give permission?

**Fields:**
- `id` - ULID
- `userId` - Who
- `consentType` - marketing | analytics | third_party
- `granted` - true | false
- `grantedAt` - Timestamp
- `withdrawnAt` - Timestamp (if revoked)

**Use Cases:**
- UC-34: GDPR consent
- UC-61: CCPA compliance

---

#### `hipaaAccessLogs` - Healthcare Compliance
**What:** Who accessed patient data?

**Fields:**
- `id` - ULID
- `userId` - Who accessed
- `patientId` - Whose data
- `accessType` - read | write | delete
- `accessedAt` - Timestamp
- `justification` - Why

**Use Cases:**
- UC-64: Healthcare audit
- UC-68: Compliance reporting

---

#### `auditLogs` - Immutable Activity Log
**What:** Everything that happened.

**Fields:**
- `id` - ULID
- `actorId` - Who did it
- `action` - create | update | delete
- `entityType` - Table name
- `entityId` - Row ID
- `changedFields` - JSONB of what changed
- `timestamp` - When

**Use Cases:**
- UC-66: Audit trail
- UC-69: Forensics
- UC-70: Compliance

---

### DOMAIN 11: EDUCATION & LEARNING (19 tables)
**Purpose:** Courses, assessments, certifications.

#### `assessmentTemplates` - Test Blueprints
**What:** Structure of an exam or quiz.

**Fields:**
- `id` - ULID
- `name` - "Hair Styling Certification"
- `version` - 1
- `passingScore` - 80

**Use Cases:**
- UC-12: Certification exams
- UC-57: Skills assessment

---

#### `assessmentAttempts` - Taking Tests
**What:** Someone taking an assessment.

**Fields:**
- `id` - ULID
- `userId` - Who
- `templateId` - Which test
- `startedAt` - When
- `completedAt` - When
- `score` - 85
- `passed` - true

**Use Cases:**
- UC-12: Certification testing
- UC-49: Progress tracking

---

### DOMAIN 12: INTELLIGENCE & ANALYTICS (22 tables)
**Purpose:** Data analysis and insights.

#### Core Tables:
- `analyticsFacts` - Measured events
- `analyticsDimensions` - Context (time, location, etc.)
- `reportingViews` - Pre-built reports
- `intelligencePredictions` - ML predictions

**Use Cases:**
- UC-28: Business analytics
- UC-55: Demand forecasting

---

### DOMAIN 13: ACCESS CONTROL (16 tables)
**Purpose:** Who can access what.

#### Core Tables:
- `accessLibraryItems` - Content library
- `accessArtifacts` - Access credentials
- `accessTransfers` - Transferring access
- `accessResaleListings` - Secondary market

**Use Cases:**
- UC-13: Digital access
- UC-37: Transferable tickets

---

### DOMAIN 14: OPERATIONS & WORKFLOW (12 tables)
**Purpose:** Task management and logistics.

#### Core Tables:
- `workflows` - Process definitions
- `workflowTasks` - Individual tasks
- `shipmentSchedules` - Delivery logistics
- `transportRoutes` - Transportation

**Use Cases:**
- UC-24: Delivery scheduling
- UC-50: Route optimization

---

### DOMAIN 15: MARKETING & CRM (18 tables)
**Purpose:** Marketing campaigns and customer relationships.

#### Core Tables:
- `marketingCampaigns` - Campaign definitions
- `crmContacts` - Customer contacts
- `crmPipelines` - Sales pipelines
- `adSpendDailyFacts` - Ad performance

**Use Cases:**
- UC-06: Marketing campaigns
- UC-38: Lead tracking

---

### DOMAIN 16: GIFTS & PROMOTIONS (9 tables)
**Purpose:** Discounts, coupons, gift cards.

#### Core Tables:
- `giftInstruments` - Gift cards
- `giftDeliveries` - Gift delivery
- `promotions` - Discount campaigns
- `promotionCodes` - Coupon codes

**Use Cases:**
- UC-06: Gift cards
- UC-22: Promo codes

---

### DOMAIN 17: CORE INFRASTRUCTURE (97 tables)
**Purpose:** Supporting infrastructure.

#### Includes:
- Config management
- API credentials
- Webhook handling
- Feature flags
- System settings
- And much more...

---

## USE CASE MAPPING

### Simple Use Cases (1-10 tables involved)

| UC | Name | Key Tables |
|----|------|------------|
| UC-01 | Basic Booking | users, offers, offerVersions, bookingOrders, paymentIntents |
| UC-02 | Staff Scheduling | users, memberships, resources, calendars, availabilityRules |
| UC-03 | Resource Booking | resources, calendars, availabilityBlocks, bookingOrders |
| UC-07 | Walk-in Queue | queues, queueEntries, users |
| UC-09 | Notifications | users, subjectSubscriptions, graphIdentities |

### Medium Use Cases (10-30 tables involved)

| UC | Name | Key Tables |
|----|------|------------|
| UC-05 | Package Deals | offers, offerVersions, offerComponents, bookingOrders, bookingOrderLines |
| UC-08 | Recurring Bookings | standingReservationContracts, standingReservationOccurrences, bookingOrders |
| UC-10 | Family Accounts | users, groupAccounts, memberships, bookingOrders |
| UC-15 | Request-based | offers, bookingOrders, approval workflows |
| UC-20 | Complex Pricing | offers, offerVersions, demandPricing, bookingOrders |

### Complex Use Cases (30+ tables involved)

| UC | Name | Key Tables |
|----|------|------------|
| UC-25 | Corporate Accounts | users, groupAccounts, enterpriseContractRates, payerEligibility, bookingOrders, paymentIntents |
| UC-31 | Auction | offers, auctions, bids, bookingOrders |
| UC-34 | GDPR Compliance | governanceConsent, governanceDataResidency, auditLogs, users |
| UC-40 | Tiered Visibility | offers, offerVersions, memberships, bookingOrders, availability |
| UC-99 | Multi-location | bizes, locations, offers, resources, calendars, bookingOrders |

---

## DATA FLOW EXAMPLES

### Example 1: Customer Books a Haircut

**Step-by-Step:**

1. **Discovery**
   - Customer browses `offers` ("Deluxe Haircut")
   - System shows `offerVersions` (current recipe)
   - Checks `availabilityRules` for open slots

2. **Selection**
   - Customer picks time slot
   - System checks `availabilityBlocks` (conflicts)
   - Reserves slot temporarily

3. **Booking**
   - Creates `bookingOrder` (confirmed)
   - Creates `bookingOrderLines` (primary service)
   - Creates `fulfillmentUnits` (stylist assignment)
   - Blocks `availabilityBlocks`

4. **Payment**
   - Creates `paymentIntent` (authorized)
   - Creates `paymentIntentTenders` (card payment)
   - Creates `paymentTransaction` (completed)

5. **Fulfillment**
   - Stylist sees `fulfillmentUnit` (9 AM appointment)
   - Service completed
   - Updates `fulfillmentUnit` status

**Tables touched:** 15+

---

### Example 2: Corporate Employee Books with Company Card

**Step-by-Step:**

1. **Authentication**
   - Employee logs in (`users`)
   - System checks `memberships` (employee role)
   - Verifies `groupAccounts` (company membership)

2. **Eligibility**
   - Checks `payerEligibility` (can use company card?)
   - Verifies `enterpriseContractRates` (special pricing)
   - May need approval based on amount

3. **Booking**
   - Creates `bookingOrder` (company billed)
   - Links to `groupAccounts` (not personal)

4. **Payment**
   - Company `paymentMethod` used
   - `paymentIntent` → `paymentTransaction`
   - Billed to company, not employee

**Tables touched:** 20+

---

### Example 3: VIP Customer Sees More Slots

**Step-by-Step:**

1. **Authentication**
   - Customer logs in (`users`)
   - System checks `memberships` (VIP tier)

2. **Offer Visibility**
   - Loads `offerVersions`
   - Checks `policyModel.slotVisibility`
   - VIP sees 10 slots (default sees 3)

3. **Advance Booking**
   - VIP can book 30 days ahead
   - Default can only book 7 days ahead
   - Checked in `tierOverrides`

**Tables touched:** 8

---

## RELATIONSHIP PATTERNS

### Pattern 1: Tenant Isolation
**Every table → bizes**
```
allTables -[belongsTo]-> bizes
```

### Pattern 2: Shell + Version
```
offers -[hasVersion]-> offerVersions
offerVersions -[usedBy]-> bookingOrders
```

### Pattern 3: Polymorphic Resources
```
resources -[type]-> host | asset | venue
resources -[hasCalendar]-> calendars
```

### Pattern 4: Immutable Snapshots
```
bookingOrders -[snapshots]-> offerVersions
bookingOrders -[records]-> pricingSnapshot
bookingOrders -[records]-> policySnapshot
```

### Pattern 5: Hierarchical Booking
```
bookingOrders -[hasLines]-> bookingOrderLines
bookingOrderLines -[scheduledAs]-> fulfillmentUnits
fulfillmentUnits -[assignedTo]-> resources
```

### Pattern 6: Payment Chain
```
bookingOrders -[requiresPayment]-> paymentIntents
paymentIntents -[usesTenders]-> paymentIntentTenders
paymentIntents -[resultsIn]-> paymentTransactions
paymentTransactions -[refundedBy]-> paymentRefunds
```

### Pattern 7: Social Graph
```
users -[hasIdentity]-> graphIdentities
graphIdentities -[subscribes]-> subjectSubscriptions
subjectSubscriptions -[watches]-> offers/bookings/queues
```

---

## QUERY COOKBOOK

### Find All Tables for a Use Case
```sql
-- Tables involved in booking
SELECT DISTINCT table_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name LIKE '%booking%';
```

### Find Foreign Keys
```sql
-- Tables referencing bookingOrders
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_name = 'booking_orders';
```

### Count Records per Domain
```sql
-- Approximate row counts by domain pattern
SELECT 
    CASE 
        WHEN table_name LIKE '%booking%' THEN 'Bookings'
        WHEN table_name LIKE '%payment%' THEN 'Payments'
        WHEN table_name LIKE '%user%' THEN 'Identity'
        ELSE 'Other'
    END as domain,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
GROUP BY domain;
```

---

## SUMMARY

### The Schema in Numbers:
- **479 tables** organized into **17 domains**
- **8,778 fields** capturing every data point
- **515 relationships** linking everything together
- **100+ use cases** covered

### Key Architectural Decisions:
1. **Tenant Isolation** - Every row has `biz_id`
2. **Shell + Version** - Mutable shells, immutable versions
3. **Snapshot Pattern** - Bookings freeze pricing/policy at time of purchase
4. **Polymorphic Resources** - Hosts, assets, venues in one table
5. **Audit Everything** - Immutable logs for compliance

### For Developers:
- Start with **Identity** (users, memberships)
- Understand **Catalog** (offers, versions)
- Master **Bookings** (orders, lines, fulfillment)
- Respect **Payments** (immutable transactions)

### For Business Analysts:
- **Simple bookings** = 10-15 tables
- **Corporate accounts** = 25+ tables
- **Full compliance** = 40+ tables

---

**This is Bizing. Business in Action.** 🌀
