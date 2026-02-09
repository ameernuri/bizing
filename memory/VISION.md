# biz.ing Vision Document

**Formerly:** Bizet
**Version:** 1.1
**Date:** February 8, 2026
**Status:** Authoritative Reference

---

## Executive Summary

**One-Liner:** Sell your services and digital products online, easily.

**Mission:** Build the Amazon of digital selling for the AI age—an AI-first, API-first, no-friction platform that lets anyone launch a digital business in minutes.

**Positioning:**
- "LatePoint + Gumroad + Eventbrite + more"
- Built for the post-AI world where automation and API-first design are table stakes
- No moats, no friction, no lock-in

**The Big Picture:**
A complete platform where a consultant can sell 1:1 sessions, a course creator can sell digital products, an educator can host workshops, and an agency can manage clients—all from one dashboard, with WordPress as the primary distribution channel.

**Extended Scope (from Bizet merger):**
- All original booking platform features retained
- Now includes digital products (Gumroad-style)
- Event ticketing (Eventbrite-style)
- Course delivery and memberships

---

## 2. Target Customers

**Primary:**
- Solopreneurs (consultants, coaches, therapists)
- Course creators and educators
- Freelancers and agencies
- Small to medium businesses

**Secondary:**
- Enterprise (long-term, via multi-tenant architecture)

**Not Targeting (Initially):**
- Physical product heavy retail
- Complex inventory management
- Restaurant/reservation systems

---

## 3. Product Scope

### 3.1 Core Capabilities

**Services (Booking - from Bizet):**
- All features needed to replace LatePoint/Amelia
- Appointments, consultations, sessions
- Multi-staff, multi-location
- Comprehensive scheduling

**Digital Products (Gumroad-Style):**
- Downloads (eBooks, templates, presets)
- Software and license keys
- Digital assets and resources

**Events & Ticketing (Eventbrite-Style):**
- Event creation and management
- Ticket types and pricing
- Virtual and in-person events
- Attendee management

**Courses & Memberships (Kajabi/Teachable-Lite):**
- Course curriculum and lessons
- Quiz and assessment tools
- Progress tracking
- Membership levels and gating

**Subscriptions & Packages:**
- Recurring subscriptions
- Product bundles
- Service + product combinations
- Membership tiers

**Physical Products:**
- Low priority
- Only under "right circumstances"
- Focus on digital first

### 3.2 Competitive Replacement

**Must replace:**
- LatePoint (booking)
- Amelia (booking + events)
- Gumroad (digital products)
- Eventbrite (events/ticketing)
- Kajabi/Teachable (courses)
- Calendly + Stripe separate (booking + payments)

**Must-have to switch from LatePoint:**
- All booking features
- Digital product delivery
- Event ticketing
- Same simplicity
- Better API/design

---

## 4. Technical Architecture

### 4.1 Tech Stack

**Runtime:** Node.js (not Edge/Workers for Socket.io)

**API Framework:** Hono + @hono/zod-openapi
- Zod schemas = source of truth
- Auto-generate OpenAPI docs
- Type safety everywhere

**Database:** PostgreSQL + Drizzle ORM

**Auth:** Better Auth + Organization Plugin
- Multi-tenant via orgs
- Multi-role (owner, admin, staff, etc.)

**Real-time:** Socket.io

**Payments:** Stripe + PayPal
- Subscriptions
- One-time payments
- Refunds

**Communications:** Twilio (SMS) + email integration

**Monorepo:** Turborepo
- `/apps/api` - Hono API server
- `/apps/admin` - Next.js admin dashboard
- `/apps/mobile` - React Native (future)
- `/packages/db` - Drizzle config
- `/packages/auth` - Auth config
- `/packages/schema` - Zod schemas (shared)

### 4.2 API Design Principles

**REST + Future-Proof GraphQL:**
- REST via @hono/zod-openapi (OpenAPI/Swagger auto-generated)
- GraphQL prepared for future (same schema)

**Type Safety:**
- Zod for validation
- Drizzle for DB types
- Shared schema package for all consumers

**Error Handling:**
- Super descriptive errors
- Standardized error format
- Appropriate HTTP status codes

**Multi-Tenancy:**
- Organization-based isolation
- Role-based access control (RBAC)
- Tenant guard middleware

### 4.3 Client Integration

**WordPress Plugin:**
- Primary distribution channel
- Consumes REST API
- Generated PHP SDK from OpenAPI spec

**Next.js Admin Dashboard:**
- Hono RPC for type-safe calls
- React components for management

**React Native (Future):**
- Same RPC client
- Mobile apps for sellers and customers

---

## 5. Feature Specifications

### 5.1 Booking Features (Service Sales - from Bizet)

**Must-Have (v1.0):**
- Service definitions (name, description, duration, price)
- Multiple duration options per service
- Service categories and organization
- Time slot generation and availability
- Buffer time (before/after)
- Customer self-booking flow
- Staff management and scheduling
- Multi-location support
- Calendar sync (Google, Outlook)
- Booking confirmation and reminders
- Booking modification and cancellation
- Deposit payments
- Tax calculation

**Should-Have (v1.1):**
- Waiting list
- Group/class bookings
- Recurring appointments
- Package deals
- Coupon/discount codes
- Custom fields
- No-show tracking

### 5.2 Digital Product Features (Gumroad-Style)

**Must-Have (v1.0):**
- Product listings (name, description, price, images)
- Digital download delivery
- Secure download links (time-limited)
- License keys (if applicable)
- One-time purchase
- Checkout flow
- Tax calculation

**Should-Have (v1.1):**
- Subscription products
- Product bundles
- Gated content/access
- Coupon codes
- Sales/discount campaigns

### 5.3 Event Ticketing Features (Eventbrite-Style)

**Must-Have (v1.0):**
- Event creation (name, description, date/time)
- Ticket types (General Admission, VIP)
- Online ticket sales
- QR code generation
- Check-in system
- Attendee management
- Event reminders

**Should-Have (v1.1):**
- Reserved seating
- Virtual/hybrid events
- Speaker management
- Agenda/schedule display
- Event analytics
- Multiple session support

### 5.4 Course & Membership Features (Kajabi-Lite)

**Should-Have (v1.0):**
- Course creation and curriculum
- Video/text lesson content
- Progress tracking
- Membership tiers
- Gated content

**Should-Have (v1.1):**
- Quiz/assessment tools
- Quiz grading
- Completion certificates
- Discussion forums
- Community features

### 5.5 Customer Management

**Must-Have (v1.0):**
- Customer profiles
- Order/purchase history
- Booking history
- Guest checkout
- Customer notes

**Should-Have (v1.1):**
- Customer tags/segmentation
- VIP status
- Lifetime value tracking
- Email marketing integration

### 5.4 Payment Features

**Must-Have (v1.0):**
- Stripe integration
- PayPal integration
- One-time payments
- Deposit payments
- Tax calculation
- Refund processing
- Payment receipts

**Should-Have (v1.1):**
- Subscriptions
- Coupon codes
- Sales/discount campaigns

### 5.5 Communication Features

**Must-Have (v1.0):**
- Email notifications (booking confirmation)
- Custom email templates

**Should-Have (v1.1):**
- SMS notifications (Twilio)
- WhatsApp notifications
- Review requests
- Automated email sequences

### 5.6 Reporting & Analytics

**Should-Have (v1.0):**
- Revenue reports
- Booking statistics
- Product sales reports

**Should-Have (v1.1):**
- Customer analytics
- Marketing attribution
- Export to CSV/PDF

### 5.7 Admin & Management

**Must-Have (v1.0):**
- Dashboard overview
- Staff management
- Service/product management
- Booking management
- Customer management
- Organization settings

**Should-Have (v1.1):**
- Role management
- Bulk operations
- Audit logs

---

## 6. WordPress Integration Strategy

### 6.1 The Plugin

**Primary Distribution:**
- WordPress.org repository
- Free plugin with premium features
- Same biz.ing backend for all

**Core Features:**
- Shortcode/blocks for booking forms
- Product display widgets
- Checkout integration
- Admin dashboard integration

**Technical Approach:**
- PHP SDK generated from OpenAPI spec
- React components for admin (WP-compatible)
- REST API calls to biz.ing backend

### 6.2 Headless Alternative

**API-First:**
- Complete REST API available
- Any platform can consume (Next.js, React, mobile)
- Type-safe clients generated automatically

**Not Focus:**
- WooCommerce integration (unless requested)
- Deep theme customization

---

## 7. Multi-Tenancy Model

### 7.1 Organization-Based

**Isolation Level:** Organization (Business)

**Structure:**
- Users belong to Organizations
- Organizations have multiple Users (owner, admin, staff)
- Organizations have Services, Products, Customers, Bookings

**Better Auth Organization Plugin:**
- Handles org membership
- Role management per org
- Permission scoping

### 7.2 Roles

**Standard Roles:**
- Owner (full control)
- Admin (manage everything)
- Manager (manage bookings/products)
- Staff (view/access assigned resources)

**Custom Roles (future):**
- Custom permission sets

---

## 8. Domain & Branding

### 8.1 Current Domain
**bizing.me** - Primary for MVP
- Cheap, available
- Can serve as URL shortener too
- Main landing and admin

### 8.2 Future Domain
**biz.ing** - Future primary
- Better branding
- Short, memorable
- "biz.ing" = business + ing (ongoing)

### 8.3 Shortlinks
**bizing.me/product-name** (or similar)
- Easy sharing for products
- Affiliate tracking ready

---

## 9. Development Phases

### Phase 1: Foundation (MVP)
**Goal:** Core booking + basic products

**Deliverables:**
- Hono API with OpenAPI docs
- Drizzle schema + migrations
- Better Auth setup
- Stripe + PayPal integration
- Basic booking flow
- Basic product listing + checkout
- Next.js admin dashboard
- WordPress plugin (basic)

**Timeline:** TBD

### Phase 2: Polish (v1.0)
**Goal:** Feature parity with LatePoint

**Deliverables:**
- SMS notifications (Twilio)
- Waitlist functionality
- Coupons and discounts
- Customer management features
- Reporting dashboard
- Email templates
- Better onboarding

### Phase 3: Growth (v1.1+)
**Goal:** Course delivery, memberships

**Deliverables:**
- Course/lesson delivery system
- Membership/subscription management
- Gated content
- Marketing automation
- React Native mobile apps
- Advanced analytics

---

## 10. Success Metrics

### Technical
- API test coverage: >90%
- Documentation completeness: 100%
- Type safety: Zero schema drift
- Response time: <200ms

### Product
- Feature parity with LatePoint (booking)
- Core Gumroad features (products)
- WordPress plugin rating: 4.5+ stars
- Customer acquisition: TBD

---

## 11. Principles & Constraints

### Design Principles
1. **API-First** - Everything starts with the API
2. **Type Safety** - Zod + Drizzle everywhere
3. **No Magic** - Explicit over implicit
4. **No Moats** - Open, portable, no lock-in
5. **No Friction** - Easy to start, easy to leave
6. **AI-Ready** - Clean API for AI agents

### Constraints
1. No GraphQL in MVP (prepared for future)
2. No physical product focus initially
3. No white-label platform (single instance)
4. No built-in email service (integrate instead)

---

## 12. Open Questions (For Discussion)

1. **User Accounts on bizing.me:**
   - Do customers need accounts on biz.ing?
   - Or guest checkout with optional accounts?

2. **Product Delivery:**
   - Secure file storage (S3, etc.)?
   - Download link expiration?
   - Download limits?

3. **Affiliate System:**
   - Later feature, but worth planning structure?

4. **Mobile Apps:**
   - Customer-facing app or just seller app?
   - React Native scope for MVP?

---

## 13. References

### Competitors Analyzed
- LatePoint (booking)
- Amelia (booking + events)
- Gumroad (digital products)
- Eventbrite (events/ticketing)
- Teachable (courses)
- Kajabi (all-in-one)
- Calendly (booking)
- Bookly (booking)

### Technical References
- Hono + @hono/zod-openapi
- Drizzle ORM
- Better Auth
- Turborepo

### Feature Research
- market-research.md (32 KB) - Booking platform analysis
- market-research-extended.md (25 KB) - Extended competitor analysis
- feature-space.md (28 KB) - Comprehensive feature catalog
- schema-design.md (32 KB) - Database schema design

---

*Document Version 1.1*
*Formerly "Bizet" - now unified as "biz.ing"*
*Author: Biz.ing Development Team*
*Approved: [Pending]*
