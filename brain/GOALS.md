# 🎯 GOALS

*Current objectives and priorities for bizing*

---

## Active Goals

### 1. Complete Foundation
**Status:** In Progress  
**Priority:** P0

- [ ] Real database connection (PostgreSQL)
- [ ] Better Auth with organization plugin
- [ ] Environment configuration
- [ ] Database migrations working

### 2. Core Booking Flow
**Status:** Not Started  
**Priority:** P0

- [ ] Create booking endpoint
- [ ] Availability calculation
- [ ] Time slot generation
- [ ] Booking confirmation

### 3. Payment Integration
**Status:** Not Started  
**Priority:** P1

- [ ] Stripe Connect setup
- [ ] Payment intents
- [ ] Deposit handling
- [ ] Refund flow

---

## Backlog

*Future goals, not yet prioritized*

- Email/SMS notifications (Twilio)
- WordPress plugin
- Calendar sync (Google, Outlook)
- Mobile app (React Native)
- Advanced analytics

---

## Completed Goals

| Goal | Completed | Notes |
|------|-----------|-------|
| Project setup | 2026-02-08 | Monorepo, API, admin scaffold |
| Schema design | 2026-02-08 | Initial Drizzle schemas |

---

## Decision Log

*Key decisions that affect goals*

| Date | Decision | Context |
|------|----------|---------|
| 2026-02-08 | Use Hono over Express | Better TypeScript, OpenAPI support |
| 2026-02-08 | Better Auth for auth | Multi-tenant out of the box |
| 2026-02-08 | PostgreSQL + Drizzle | Type-safe ORM, good migrations |

---

## 🔗 Related

- [[STATUS]] - Current project state
- [[01-design/VISION]] - Long-term vision
- [[03-operations/WORKFLOW]] - How we achieve goals

---
*Last updated: 2026-02-11*
