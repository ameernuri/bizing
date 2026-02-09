# Booking Schema Design

> Status: 2026-02-08 | Prefer Markdown over Excalidraw

## Core Entities

### Organizations
- `id` UUID PK
- `name` VARCHAR(255)
- `slug` VARCHAR(100) UNIQUE
- `logo_url` VARCHAR(500)
- `timezone` VARCHAR(50)
- `currency` VARCHAR(3)
- `settings` JSONB
- `status` VARCHAR(20)
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

### Users
- `id` UUID PK
- `org_id` UUID FK → organizations
- `email` VARCHAR(255) UNIQUE
- `password_hash` VARCHAR(255)
- `first_name` VARCHAR(100)
- `last_name` VARCHAR(100)
- `phone` VARCHAR(50)
- `role` VARCHAR(20)
- `status` VARCHAR(20)
- `avatar_url` VARCHAR(500)

### Assets
- `id` UUID PK
- `org_id` UUID FK → organizations
- `category_id` UUID FK → asset_categories
- `name` VARCHAR(255)
- `slug` VARCHAR(100)
- `description` TEXT
- `status` VARCHAR(20)
- `capacity` INTEGER
- `location` TEXT
- `calendar_id` VARCHAR(100)
- `metadata` JSONB

### Asset Categories
- `id` UUID PK
- `org_id` UUID FK → organizations
- `name` VARCHAR(100)
- `slug` VARCHAR(100)
- `description` TEXT

### Asset Tags
- `id` UUID PK
- `asset_id` UUID FK → assets
- `name` VARCHAR(50)

### Venues
- `id` UUID PK
- `org_id` UUID FK → organizations
- `name` VARCHAR(255)
- `address` TEXT
- `capacity` INTEGER
- `calendar_id` VARCHAR(100)
- `amenities` JSONB

### Bookings
- `id` UUID PK
- `org_id` UUID FK → organizations
- `service_id` UUID FK → services
- `asset_id` UUID FK → assets
- `venue_id` UUID FK → venues
- `customer_id` UUID FK → users
- `customer_name` VARCHAR(255)
- `customer_email` VARCHAR(255)
- `customer_phone` VARCHAR(50)
- `start_time` TIMESTAMPTZ
- `end_time` TIMESTAMPTZ
- `status` VARCHAR(20)
- `price` DECIMAL(10,2)
- `source` VARCHAR(50)
- `confirmation_code` VARCHAR(20)
- `notes` TEXT

### Services
- `id` UUID PK
- `org_id` UUID FK → organizations
- `name` VARCHAR(255)
- `slug` VARCHAR(100)
- `description` TEXT
- `duration_minutes` INTEGER
- `price` DECIMAL(10,2)
- `currency` VARCHAR(3)
- `is_active` BOOLEAN
- `is_online_bookable` BOOLEAN

## Relationships

```
Organizations → Users (1:N)
Organizations → Assets (1:N)
Organizations → Services (1:N)
Organizations → Venues (1:N)
Organizations → Categories (1:N)

Assets → Categories (N:1)
Assets → Tags (1:N)
Assets → Bookings (1:N)

Venues → Bookings (1:N)
Services → Bookings (1:N)
Users → Bookings (N:1)
```

## Key Concepts

### Assets
Things that can be booked. Examples: cars, tools, equipment. Have categories and tags. Can have capacity limits.

### Venues
Similar to assets. Have their own calendars. Have physical capacity. Examples: rooms, courts, tables.

### Categories
Used to differentiate asset types. One category → many assets. Examples: "Vehicles", "Tools", "Electronics".

### Tags
Used for specific differentiation. Many tags → one asset. Examples: "training-car", "testing-equipment".

### Bookings
Link assets, venues, services to customers. Track pricing, status, confirmation codes. Multi-resource booking support.
