---
kanban-plugin: board
---

# 🎯 Goals

*Current objectives and priorities for Bizing*

---

## P0 - Critical

- [ ] #foundation Complete Foundation
  - Real database connection (PostgreSQL)
  - Better Auth with organization plugin
  - Environment configuration
  - Database migrations working

- [ ] #booking Core Booking Flow
  - Create booking endpoint
  - Availability calculation
  - Time slot generation
  - Booking confirmation

---

## P1 - High

- [ ] #payment Payment Integration
  - Stripe Connect setup
  - Payment intents
  - Deposit handling
  - Refund flow

---

## P2 - Medium

- [ ] #notifications Email/SMS notifications (Twilio)
- [ ] #integrations WordPress plugin
- [ ] #integrations Calendar sync (Google, Outlook)

---

## P3 - Low

- [ ] #mobile Mobile app (React Native)
- [ ] #analytics Advanced analytics

---

## Backlog

*Future ideas, not yet prioritized*

- [ ] AI-powered booking suggestions
- [ ] Multi-language support
- [ ] White-label customization

---

## Completed

- [x] #setup Project setup (2026-02-08)
  - Monorepo, API, admin scaffold
- [x] #schema Schema design (2026-02-08)
  - Initial Drizzle schemas

---

## Decision Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-02-08 | Use Hono over Express | Better TypeScript, OpenAPI support |
| 2026-02-08 | Better Auth for auth | Multi-tenant out of the box |
| 2026-02-08 | PostgreSQL + Drizzle | Type-safe ORM, good migrations |

---

## Related

- [[STATUS]] - Current project state
- [[01-design/VISION]] - Long-term vision
- [[symbiosis/standup]] - Daily priorities

---

*Last updated: 2026-02-11*
