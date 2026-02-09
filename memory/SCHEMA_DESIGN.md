# Bizet Database Schema Design

**Version:** 1.0
**Date:** February 7, 2026
**Status:** Draft - For Review

---

## Overview

This document describes the database schema for Bizet, a Next.js booking platform with WordPress integration. The schema is designed with three core principles:

1. **Multi-tenancy from day one** - Organizations, locations, and staff operate in isolated contexts
2. **Temporal data** - All entities track creation and modification timestamps
3. **Soft delete support** - Deleted records can be recovered or audited

---

## Entity Relationship Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ORGS      │────▶│  LOCATIONS  │────▶│    USERS    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │                   │                   │
      ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USERS     │◀────│ SERVICE     │────▶│   SLOTS     │
│ (Members)   │     │ CATEGORIES  │     │(Availability)│
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │                   │                   │
      ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│                      BOOKINGS                        │
│         (The core transactional entity)              │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  CUSTOMERS                          │
│         (Guests and registered customers)           │
└─────────────────────────────────────────────────────┘
```

---

## Core Entities

### 1. Organizations (`orgs`)

**Purpose:** The top-level tenant entity. Each business, clinic, salon, or service provider operates within their own organization.

**Business Rules:**
- One organization per paid subscription
- Organizations can have multiple locations
- All data is scoped to organization

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key, auto-generated ULID |
| `name` | VARCHAR(255) | NOT NULL | Organization/business name |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | URL-friendly identifier |
| `logo_url` | VARCHAR(500) | NULL | Organization logo |
| `timezone` | VARCHAR(50) | NOT NULL | Default timezone (e.g., "America/Los_Angeles") |
| `currency` | VARCHAR(3) | NOT NULL | ISO 4217 currency code (e.g., "USD") |
| `status` | ENUM | NOT NULL | `active`, `suspended`, `trial`, `cancelled` |
| `trial_ends_at` | TIMESTAMP | NULL | Trial expiration |
| `subscription_tier` | ENUM | NOT NULL | `free`, `pro`, `agency` |
| `stripe_account_id` | VARCHAR(255) | NULL | Connected Stripe account |
| `settings` | JSONB | DEFAULT `{}` | Organization-wide settings |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |

**Indexes:**
- `idx_orgs_slug` ON (`slug`)
- `idx_orgs_status` ON (`status`)

---

### 2. Locations (`locations`)

**Purpose:** Physical or virtual places where services are delivered. A salon might have "Downtown" and "Uptown" locations; a consultant might have "Main Office" and "Virtual."

**Business Rules:**
- Each location belongs to one organization
- A location can offer a subset of services
- Locations have their own operating hours and holidays

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Parent organization |
| `name` | VARCHAR(255) | NOT NULL | Location name |
| `slug` | VARCHAR(100) | NOT NULL | URL-friendly identifier |
| `type` | ENUM | NOT NULL | `physical`, `virtual`, `mixed` |
| `address` | TEXT | NULL | Physical address |
| `city` | VARCHAR(100) | NULL | City |
| `state` | VARCHAR(100) | NULL | State/Province |
| `postal_code` | VARCHAR(20) | NULL | ZIP/Postal code |
| `country` | VARCHAR(2) | NULL | ISO 3166-1 alpha-2 |
| `latitude` | DECIMAL(10,8) | NULL | GPS latitude |
| `longitude` | DECIMAL(11,8) | NULL | GPS longitude |
| `timezone` | VARCHAR(50) | NULL | Override org timezone |
| `phone` | VARCHAR(50) | NULL | Contact phone |
| `email` | VARCHAR(255) | NULL | Contact email |
| `map_url` | VARCHAR(500) | NULL | Google Maps link |
| `virtual_meeting_url` | VARCHAR(500) | NULL | Zoom/Meet link |
| `is_default` | BOOLEAN | DEFAULT FALSE | Primary location |
| `status` | ENUM | NOT NULL | `active`, `inactive`, `archived` |
| `settings` | JSONB | DEFAULT `{}` | Location-specific settings |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |

**Indexes:**
- `idx_locations_org_id` ON (`org_id`)
- `idx_locations_status` ON (`status`)
- `idx_locations_type` ON (`type`)

**Relationships:**
- Many-to-One with `orgs`
- One-to-Many with `staff`
- One-to-Many with `service_locations`
- One-to-Many with `opening_hours`
- One-to-Many with `holidays`

---

### 3. Service Categories (`service_categories`)

**Purpose:** Groups related services together. For a salon: "Hair," "Nails," "Spa Treatments." For a clinic: "General Medicine," "Specialist," "Diagnostics."

**Business Rules:**
- Categories are organization-scoped
- Categories can be nested (parent/child)
- Services belong to exactly one category

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Parent organization |
| `parent_id` | UUID | FK → `service_categories.id`, NULL | Parent category (nesting) |
| `name` | VARCHAR(255) | NOT NULL | Category name |
| `slug` | VARCHAR(100) | NOT NULL | URL-friendly identifier |
| `description` | TEXT | NULL | Category description |
| `icon` | VARCHAR(100) | NULL | Icon identifier |
| `color` | VARCHAR(7) | NULL | Hex color (e.g., "#FF5733") |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |
| `is_active` | BOOLEAN | DEFAULT TRUE | Category visibility |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |

**Indexes:**
- `idx_service_categories_org_id` ON (`org_id`)
- `idx_service_categories_parent_id` ON (`parent_id`)

**Relationships:**
- Many-to-One with `orgs`
- Many-to-One with `service_categories` (self-referential)
- One-to-Many with `services`

---

### 4. Services (`services`)

**Purpose:** The bookable offering. A "60-minute Massage," "Initial Consultation," or "Haircut & Style."

**Business Rules:**
- Each service belongs to one organization and one category
- Services can be offered at multiple locations
- Duration and pricing can vary by location
- Services can require specific staff qualifications

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Parent organization |
| `category_id` | UUID | FK → `service_categories.id`, NULL | Parent category |
| `name` | VARCHAR(255) | NOT NULL | Service name |
| `slug` | VARCHAR(100) | NOT NULL | URL-friendly identifier |
| `description` | TEXT | NULL | Long description |
| `short_description` | VARCHAR(500) | NULL | For cards/lists |
| `duration_minutes` | INTEGER | NOT NULL | Default duration |
| `buffer_before_minutes` | INTEGER | DEFAULT 0 | Prep time required |
| `buffer_after_minutes` | INTEGER | DEFAULT 0 | Cleanup time |
| `capacity_min` | INTEGER | DEFAULT 1 | Minimum participants |
| `capacity_max` | INTEGER | DEFAULT 1 | Maximum participants |
| `is_active` | BOOLEAN | DEFAULT TRUE | Service visibility |
| `is_online_bookable` | BOOLEAN | DEFAULT TRUE | Show in booking flow |
| `booking_window_start` | INTEGER | DEFAULT 0 | Days in advance booking opens |
| `booking_window_end` | INTEGER | DEFAULT 365 | Days in advance booking closes |
| `cancellation_window_hours` | INTEGER | DEFAULT 24 | Hours before free cancel |
| `late_cancel_fee_percent` | DECIMAL(5,2) | NULL | Late cancellation fee |
| `image_url` | VARCHAR(500) | NULL | Service image |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |

**Indexes:**
- `idx_services_org_id` ON (`org_id`)
- `idx_services_category_id` ON (`category_id`)
- `idx_services_is_active` ON (`is_active`)

**Relationships:**
- Many-to-One with `orgs`
- Many-to-One with `service_categories`
- One-to-Many with `service_locations`
- One-to-Many with `service_pricing`
- One-to-Many with `bookings`

---

### 5. Service Locations (`service_locations`)

**Purpose:** Junction table for services offered at locations. Allows per-location pricing, duration, and availability.

**Business Rules:**
- A service can be offered at multiple locations
- Each service-location pair has its own pricing and duration
- Removing a service from a location doesn't delete the service

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `service_id` | UUID | FK → `services.id`, NOT NULL | Service |
| `location_id` | UUID | FK → `locations.id`, NOT NULL | Location |
| `duration_minutes` | INTEGER | NULL | Override service default |
| `is_active` | BOOLEAN | DEFAULT TRUE | Offer at this location |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

**Constraints:**
- UNIQUE(`service_id`, `location_id`)

---

### 6. Service Pricing (`service_pricing`)

**Purpose:** Handles complex pricing including base prices, variations, and custom pricing per location/staff.

**Business Rules:**
- Multiple pricing tiers per service
- Can be scoped to location, staff, or customer type
- Supports time-based pricing (happy hour, peak hours)

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `service_id` | UUID | FK → `services.id`, NOT NULL | Service |
| `name` | VARCHAR(100) | NOT NULL | Price tier name |
| `type` | ENUM | NOT NULL | `base`, `variation`, `promotion` |
| `amount` | DECIMAL(10,2) | NOT NULL | Price amount |
| `currency` | VARCHAR(3) | NOT NULL | ISO 4217 currency |
| `is_deposit` | BOOLEAN | DEFAULT FALSE | Is deposit-only |
| `deposit_percent` | DECIMAL(5,2) | NULL | Deposit percentage |
| `deposit_fixed` | DECIMAL(10,2) | NULL | Fixed deposit amount |
| `staff_id` | UUID | FK → `users.id`, NULL | Staff-specific price |
| `location_id` | UUID | FK → `locations.id`, NULL | Location-specific price |
| `customer_type` | ENUM | NULL | `new`, `returning`, `vip` |
| `valid_from` | TIMESTAMP | NULL | Price valid from |
| `valid_until` | TIMESTAMP | NULL | Price valid until |
| `min_quantity` | INTEGER | DEFAULT 1 | Minimum quantity |
| `max_quantity` | INTEGER | NULL | Maximum quantity |
| `is_active` | BOOLEAN | DEFAULT TRUE | Price active |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

**Indexes:**
- `idx_service_pricing_service_id` ON (`service_id`)

---

### 7. Staff / Team Members (`users`)

**Purpose:** People who deliver services. Can be employees, contractors, or the business owner.

**Business Rules:**
- Staff belong to one organization
- Staff can work at multiple locations
- Staff have roles and permissions
- Staff have individual schedules and availability

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Parent organization |
| `email` | VARCHAR(255) | NOT NULL | Login email |
| `password_hash` | VARCHAR(255) | NULL | Hashed password |
| `first_name` | VARCHAR(100) | NOT NULL | First name |
| `last_name` | VARCHAR(100) | NOT NULL | Last name |
| `display_name` | VARCHAR(200) | NULL | Shown publicly |
| `avatar_url` | VARCHAR(500) | NULL | Profile photo |
| `phone` | VARCHAR(50) | NULL | Contact phone |
| `bio` | TEXT | NULL | Staff biography |
| `role` | ENUM | NOT NULL | `owner`, `admin`, `manager`, `staff`, `contractor` |
| `status` | ENUM | NOT NULL | `active`, `inactive`, `pending` |
| `timezone` | VARCHAR(50) | NULL | Override org timezone |
| `default_location_id` | UUID | FK → `locations.id`, NULL | Primary location |
| `booking_url` | VARCHAR(200) | NULL | Direct booking link |
| `stripe_account_id` | VARCHAR(255) | NULL | For payouts |
| `commission_percent` | DECIMAL(5,2) | NULL | Commission rate |
| `settings` | JSONB | DEFAULT `{}` | User preferences |
| `email_verified_at` | TIMESTAMP | NULL | Email verified |
| `last_login_at` | TIMESTAMP | NULL | Last login |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |

**Indexes:**
- `idx_users_org_id` ON (`org_id`)
- `idx_users_email` ON (`email`)
- `idx_users_status` ON (`status`)

**Relationships:**
- Many-to-One with `orgs`
- Many-to-One with `locations`
- One-to-Many with `staff_locations`
- One-to-Many with `staff_availability`
- One-to-Many with `bookings` (as staff)
- One-to-Many with `appointments` (as customer)

---

### 8. Staff Locations (`staff_locations`)

**Purpose:** Defines which staff work at which locations and their schedules there.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `staff_id` | UUID | FK → `users.id`, NOT NULL | Staff member |
| `location_id` | UUID | FK → `locations.id`, NOT NULL | Location |
| `is_primary` | BOOLEAN | DEFAULT FALSE | Primary location |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

**Constraints:**
- UNIQUE(`staff_id`, `location_id`)

---

### 9. Availability Templates (`availability_templates`)

**Purpose:** Reusable weekly schedules that can be assigned to staff at locations.

**Business Rules:**
- Templates define recurring weekly availability
- Each day can have multiple time blocks
- Templates can be recurring or one-time overrides

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Parent organization |
| `name` | VARCHAR(100) | NOT NULL | Template name |
| `type` | ENUM | NOT NULL | `weekly`, `seasonal`, `override` |
| `is_default` | BOOLEAN | DEFAULT FALSE | Default for new staff |
| `is_active` | BOOLEAN | DEFAULT TRUE | Template active |
| `valid_from` | DATE | NULL | Template valid from |
| `valid_until` | DATE | NULL | Template valid until |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

**Indexes:**
- `idx_availability_templates_org_id` ON (`org_id`)

**Relationships:**
- Many-to-One with `orgs`
- One-to-Many with `availability_slots`

---

### 10. Availability Slots (`availability_slots`)

**Purpose:** Individual time blocks within an availability template.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `template_id` | UUID | FK → `availability_templates.id`, NOT NULL | Parent template |
| `day_of_week` | SMALLINT | NULL | 0=Sunday, 6=Saturday (for weekly) |
| `date` | DATE | NULL | Specific date (for overrides) |
| `start_time` | TIME | NOT NULL | Start time |
| `end_time` | TIME | NOT NULL | End time |
| `location_id` | UUID | FK → `locations.id`, NULL | Location |
| `service_id` | UUID | FK → `services.id`, NULL | Service-specific |
| `max_appointments` | INTEGER | NULL | Max appointments in slot |
| `is_available` | BOOLEAN | DEFAULT TRUE | Slot active |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |

---

### 11. Individual Staff Availability (`staff_availability`)

**Purpose:** Individual schedule overrides and exceptions for staff.

**Business Rules:**
- Overrides take precedence over templates
- Can block time or add extra availability
- Can be recurring or one-time

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `staff_id` | UUID | FK → `users.id`, NOT NULL | Staff member |
| `type` | ENUM | NOT NULL | `available`, `unavailable`, `override` |
| `date` | DATE | NOT NULL | Date |
| `start_time` | TIME | NULL | Start time (NULL = all day) |
| `end_time` | TIME | NULL | End time (NULL = all day) |
| `location_id` | UUID | FK → `locations.id`, NULL | Location |
| `reason` | VARCHAR(255) | NULL | Reason for unavailability |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

**Indexes:**
- `idx_staff_availability_staff_id` ON (`staff_id`)
- `idx_staff_availability_date` ON (`date`)

---

### 12. Customers (`customers`)

**Purpose:** People who book appointments. Can be guests (one-time) or registered customers.

**Business Rules:**
- Customers can belong to multiple organizations
- Guest bookings don't create customer records
- Customers have booking history and notes

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Organization |
| `email` | VARCHAR(255) | NOT NULL | Contact email |
| `phone` | VARCHAR(50) | NULL | Contact phone |
| `first_name` | VARCHAR(100) | NULL | First name |
| `last_name` | VARCHAR(100) | NULL | Last name |
| `full_name` | VARCHAR(200) | NULL | Computed full name |
| `avatar_url` | VARCHAR(500) | NULL | Photo |
| `date_of_birth` | DATE | NULL | For birthday promotions |
| `gender` | ENUM | NULL | `male`, `female`, `nonbinary`, `prefer_not_to_say` |
| `notes` | TEXT | NULL | Internal notes |
| `vip_status` | BOOLEAN | DEFAULT FALSE | VIP customer |
| `total_bookings` | INTEGER | DEFAULT 0 | Lifetime bookings |
| `total_spent` | DECIMAL(12,2) | DEFAULT 0 | Lifetime spend |
| `no_show_count` | SMALLINT | DEFAULT 0 | No-show incidents |
| `cancellation_count` | SMALLINT | DEFAULT 0 | Cancellations |
| `last_booking_at` | TIMESTAMP | NULL | Last booking |
| `stripe_customer_id` | VARCHAR(255) | NULL | Stripe customer |
| `custom_fields` | JSONB | DEFAULT `{}` | Custom field values |
| `marketing_opt_in` | BOOLEAN | DEFAULT FALSE | Email marketing |
| `sms_opt_in` | BOOLEAN | DEFAULT FALSE | SMS marketing |
| `preferred_locale` | VARCHAR(10) | NULL | Preferred language |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |

**Indexes:**
- `idx_customers_org_id` ON (`org_id`)
- `idx_customers_email` ON (`email`)
- `idx_customers_phone` ON (`phone`)

**Relationships:**
- Many-to-One with `orgs`
- One-to-Many with `bookings`
- One-to-Many with `customer_addresses`

---

### 13. Customer Addresses (`customer_addresses`)

**Purpose:** Stored addresses for customers (for home services, shipping, etc.)

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `customer_id` | UUID | FK → `customers.id`, NOT NULL | Customer |
| `label` | VARCHAR(50) | NULL | Label (Home, Work) |
| `address` | TEXT | NOT NULL | Street address |
| `city` | VARCHAR(100) | NULL | City |
| `state` | VARCHAR(100) | NULL | State |
| `postal_code` | VARCHAR(20) | NULL | ZIP code |
| `country` | VARCHAR(2) | NULL | Country |
| `latitude` | DECIMAL(10,8) | NULL | GPS latitude |
| `longitude` | DECIMAL(11,8) | NULL | GPS longitude |
| `is_default` | BOOLEAN | DEFAULT FALSE | Default address |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

---

### 14. Customer Tags (`customer_tags`)

**Purpose:** Categorize customers for marketing and segmentation.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Organization |
| `name` | VARCHAR(50) | NOT NULL | Tag name |
| `slug` | VARCHAR(50) | NOT NULL | Tag slug |
| `color` | VARCHAR(7) | NULL | Hex color |
| `description` | VARCHAR(255) | NULL | Tag description |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |

**Indexes:**
- `idx_customer_tags_org_id` ON (`org_id`)

---

### 15. Customers X Tags (`customers_x_tags`)

**Purpose:** Many-to-many relationship between customers and tags.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `customer_id` | UUID | FK → `customers.id`, NOT NULL | Customer |
| `tag_id` | UUID | FK → `customer_tags.id`, NOT NULL | Tag |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |

**Constraints:**
- UNIQUE(`customer_id`, `tag_id`)

---

### 16. Bookings (`bookings`)

**Purpose:** The core transactional entity. Represents a scheduled appointment.

**Business Rules:**
- A booking is for one service at one location with one or more staff
- Bookings have a lifecycle: pending → confirmed → completed/cancelled
- Status changes trigger notifications
- Cancellations within cancellation window may incur fees

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Organization |
| `customer_id` | UUID | FK → `customers.id`, NULL | Customer (NULL = guest) |
| `guest_name` | VARCHAR(200) | NULL | Guest name |
| `guest_email` | VARCHAR(255) | NULL | Guest email |
| `guest_phone` | VARCHAR(50) | NULL | Guest phone |
| `service_id` | UUID | FK → `services.id`, NOT NULL | Service |
| `location_id` | UUID | FK → `locations.id`, NOT NULL | Location |
| `status` | ENUM | NOT NULL | `pending`, `confirmed`, `seated`, `in_progress`, `completed`, `cancelled`, `no_show`, `rescheduled` |
| `start_time` | TIMESTAMP | NOT NULL | Booking start |
| `end_time` | TIMESTAMP | NOT NULL | Booking end |
| `duration_minutes` | INTEGER | NOT NULL | Actual duration |
| `guest_count` | SMALLINT | DEFAULT 1 | Number of guests |
| `notes` | TEXT | NULL | Customer notes |
| `internal_notes` | TEXT | NULL | Staff-only notes |
| `source` | ENUM | NOT NULL | `website`, `phone`, `walkin`, `api`, `import` |
| `booking_source` | VARCHAR(50) | NULL | Specific source |
| `utm_source` | VARCHAR(100) | NULL | Marketing attribution |
| `utm_medium` | VARCHAR(100) | NULL | Marketing medium |
| `utm_campaign` | VARCHAR(100) | NULL | Marketing campaign |
| `coupon_code` | VARCHAR(50) | NULL | Applied coupon |
| `discount_amount` | DECIMAL(10,2) | DEFAULT 0 | Discount applied |
| `subtotal` | DECIMAL(10,2) | NOT NULL | Before tax/fees |
| `tax_amount` | DECIMAL(10,2) | DEFAULT 0 | Tax |
| `tip_amount` | DECIMAL(10,2) | DEFAULT 0 | Tip |
| `total_amount` | DECIMAL(10,2) | NOT NULL | Final total |
| `deposit_amount` | DECIMAL(10,2) | DEFAULT 0 | Deposit paid |
| `deposit_payment_id` | VARCHAR(255) | NULL | Payment record |
| `deposit_paid_at` | TIMESTAMP | NULL | Deposit paid |
| `fully_paid_at` | TIMESTAMP | NULL | Full payment |
| `refund_amount` | DECIMAL(10,2) | DEFAULT 0 | Total refunded |
| `cancellation_reason` | VARCHAR(255) | NULL | Cancel reason |
| `cancellation_fee` | DECIMAL(10,2) | DEFAULT 0 | Cancellation fee |
| `cancelled_by` | ENUM | NULL | `customer`, `staff`, `system` |
| `cancelled_at` | TIMESTAMP | NULL | Cancellation time |
| `rescheduled_from_id` | UUID | FK → `bookings.id`, NULL | Original booking |
| `confirmation_code` | VARCHAR(20) | UNIQUE | Customer-facing code |
| `reminder_sent_at` | TIMESTAMP | NULL | Reminder notification |
| `custom_fields` | JSONB | DEFAULT `{}` | Custom field responses |
| `metadata` | JSONB | DEFAULT `{}` | Internal metadata |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |
| `deleted_at` | TIMESTAMP | NULL | Soft delete timestamp |

**Indexes:**
- `idx_bookings_org_id` ON (`org_id`)
- `idx_bookings_customer_id` ON (`customer_id`)
- `idx_bookings_service_id` ON (`service_id`)
- `idx_bookings_location_id` ON (`location_id`)
- `idx_bookings_status` ON (`status`)
- `idx_bookings_start_time` ON (`start_time`)
- `idx_bookings_confirmation_code` ON (`confirmation_code`)

**Relationships:**
- Many-to-One with `orgs`
- Many-to-One with `customers`
- Many-to-One with `services`
- Many-to-One with `locations`
- Many-to-One with `bookings` (rescheduled_from)
- One-to-Many with `booking_staff`
- One-to-Many with `booking_items`
- One-to-Many with `booking_payments`
- One-to-Many with `booking_files`

---

### 17. Booking Staff (`booking_staff`)

**Purpose:** Staff assigned to a booking. Supports multiple staff per booking.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `booking_id` | UUID | FK → `bookings.id`, NOT NULL | Booking |
| `staff_id` | UUID | FK → `users.id`, NOT NULL | Staff member |
| `is_primary` | BOOLEAN | DEFAULT FALSE | Primary staff |
| `notes` | VARCHAR(255) | NULL | Staff notes |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |

**Constraints:**
- UNIQUE(`booking_id`, `staff_id`)

---

### 18. Booking Items (`booking_items`)

**Purpose:** Line items within a booking (for packages, extras, add-ons).

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `booking_id` | UUID | FK → `bookings.id`, NOT NULL | Booking |
| `service_id` | UUID | FK → `services.id`, NULL | Service |
| `name` | VARCHAR(255) | NOT NULL | Item name |
| `description` | TEXT | NULL | Item description |
| `quantity` | INTEGER | NOT NULL DEFAULT 1 | Quantity |
| `unit_price` | DECIMAL(10,2) | NOT NULL | Price per unit |
| `total_price` | DECIMAL(10,2) | NOT NULL | Line total |
| `duration_minutes` | INTEGER | NULL | Added duration |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |

---

### 19. Booking Payments (`booking_payments`)

**Purpose:** Track all payment transactions for a booking.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `booking_id` | UUID | FK → `bookings.id`, NOT NULL | Booking |
| `customer_id` | UUID | FK → `customers.id`, NULL | Customer |
| `type` | ENUM | NOT NULL | `deposit`, `balance`, `tip`, `refund`, `fee` |
| `amount` | DECIMAL(10,2) | NOT NULL | Amount |
| `currency` | VARCHAR(3) | NOT NULL | Currency |
| `method` | ENUM | NOT NULL | `card`, `cash`, `bank`, `gift_card`, `other` |
| `provider` | VARCHAR(50) | NULL | Payment provider |
| `transaction_id` | VARCHAR(255) | NULL | Provider transaction ID |
| `status` | ENUM | NOT NULL | `pending`, `completed`, `failed`, `refunded`, `partially_refunded` |
| `gateway_response` | JSONB | NULL | Full gateway response |
| `receipt_url` | VARCHAR(500) | NULL | Payment receipt |
| `paid_at` | TIMESTAMP | NULL | Payment completed |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

**Indexes:**
- `idx_booking_payments_booking_id` ON (`booking_id`)
- `idx_booking_payments_status` ON (`status`)

---

### 20. Booking Files (`booking_files`)

**Purpose:** Attachments for bookings (contracts, intake forms, photos).

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `booking_id` | UUID | FK → `bookings.id`, NOT NULL | Booking |
| `customer_id` | UUID | FK → `customers.id`, NULL | Uploaded by customer |
| `staff_id` | UUID | FK → `users.id`, NULL | Uploaded by staff |
| `name` | VARCHAR(255) | NOT NULL | File name |
| `file_type` | VARCHAR(100) | NOT NULL | MIME type |
| `file_size` | INTEGER | NOT NULL | Size in bytes |
| `file_url` | VARCHAR(500) | NOT NULL | Storage URL |
| `purpose` | VARCHAR(50) | NULL | `contract`, `form`, `photo`, `other` |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |

---

### 21. Waiting List (`waiting_list`)

**Purpose:** Customers can join a waitlist when their preferred slot is unavailable.

**Business Rules:**
- Waitlist entries expire
- Customers can be notified when spots open
- Priority based on join time or VIP status

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `org_id` | UUID | FK → `orgs.id`, NOT NULL | Organization |
| `customer_id` | UUID | FK → `customers.id`, NOT NULL | Customer |
| `service_id` | UUID | FK → `services.id`, NOT NULL | Service |
| `location_id` | UUID | FK → `locations.id`, NULL | Location |
| `staff_id` | UUID | FK → `users.id`, NULL | Preferred staff |
| `preferred_date` | DATE | NULL | Preferred date |
| `preferred_time_start` | TIME | NULL | Preferred start time |
| `preferred_time_end` | TIME | NULL | Preferred end time |
| `status` | ENUM | NOT NULL | `waiting`, `notified`, `booked`, `expired`, `cancelled` |
| `priority` | INTEGER | DEFAULT 0 | Priority (higher = sooner) |
| `expires_at` | TIMESTAMP | NULL | Entry expiration |
| `notified_at` | TIMESTAMP | NULL | Last notification |
| `notified_count` | SMALLINT | DEFAULT 0 | Notification count |
| `notes` | TEXT | NULL | Customer notes |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

**Indexes:**
- `idx_waiting_list_org_id` ON (`org_id`)
- `idx_waiting_list_customer_id` ON (`customer_id`)
- `idx_waiting_list_service_id` ON (`service_id`)
- `idx_waiting_list_status` ON (`status`)

---

### 22. Notifications (`notifications`)

**Purpose:** Track all notifications sent (email, SMS, push, webhook).

**Fields:**

| Field | Type | Constraints | Description |
