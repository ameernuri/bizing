# ⚙️ Technical Knowledge

*How Bizing works under the hood. The technical architecture.*

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  Interface Layer                        │
│  - API (Hono)                           │
│  - Admin UI (Next.js)                   │
│  - Agent Interfaces                     │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│  Service Layer                          │
│  - Domain logic                         │
│  - Business rules                       │
│  - Validation                           │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│  Data Layer                             │
│  - Drizzle ORM                          │
│  - PostgreSQL                           │
│  - Migrations                           │
└─────────────────────────────────────────┘
```

---

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| API | [[stack/hono|Hono]] | Fast, lightweight API |
| Admin | [[stack/nextjs|Next.js]] | React-based admin |
| ORM | [[stack/drizzle|Drizzle]] | Type-safe SQL |
| Auth | [[stack/better-auth|Better Auth]] | Authentication |
| DB | [[stack/postgres|PostgreSQL]] | Data storage |
| Monorepo | [[stack/turborepo|Turborepo]] | Package management |

---

## Key Patterns

### Repository Pattern
- [[patterns/repository|Repository Pattern]]
- Data access abstraction
- Type-safe queries

### Domain Services
- [[patterns/domain-services|Domain Services]]
- Business logic encapsulation
- Transaction boundaries

### API Design
- [[patterns/api-design|API Design]]
- RESTful principles
- Agent-optimized endpoints

### Authentication
- [[patterns/auth|Auth Flow]]
- JWT handling
- Permission system

---

## File Structure

```
biz.ing/
├── apps/
│   ├── api/              # Hono API
│   └── admin/            # Next.js admin
├── packages/
│   ├── db/               # Drizzle schema + migrations
│   ├── auth/             # Better Auth config
│   ├── types/            # Shared types
│   └── ui/               # Shared UI components
└── brain/                # Bizing's consciousness
```

---

## Agent-Optimized Design

**For AI agents consuming Bizing:**
- [[agent-api-design|Agent API Design]]
- Self-documenting endpoints
- Context-rich responses
- Semantic understanding

---

## Links

- [[../domain/index|Domain Knowledge]]
- [[../api/index|API Documentation]]
- [[../../agents/dev|Developer Agent]]
- [[../../interfaces/api|API Interface]]
