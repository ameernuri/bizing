# **Bizing**

**Run your business without the back-and-forth.**

A modern, API-first business platform for operations, scheduling, sales, payments, and customer communication. Built with TypeScript, Next.js, and Hono.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

### Installation

```bash
# Clone and enter directory
cd bizing

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Setup database (requires PostgreSQL running)
pnpm db:migrate

# Start development servers
pnpm dev
```

### Access Points

| Service         | URL                       | Description           |
| --------------- | ------------------------- | --------------------- |
| API Server      | http://localhost:6000     | REST API              |
| API Docs        | http://localhost:6000/doc | OpenAPI Documentation |
| Admin Dashboard | http://localhost:9000     | Admin UI              |

## 📁 Project Structure

```
bizing/
├── apps/
│   ├── api/           # Hono API server
│   └── admin/        # Next.js admin dashboard
└── packages/
    ├── db/           # Drizzle ORM schemas
    ├── auth/         # Better Auth configuration
    ├── schema/       # Zod validation schemas
    └── api-client/   # Generated API client
```

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **API Framework:** Hono + @hono/zod-openapi
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Better Auth
- **Frontend:** Next.js 14 + React + Tailwind CSS
- **Monorepo:** Turborepo + pnpm

## 📚 Documentation

Canonical engineering docs now live under [`docs/`](docs/):

- [`docs/INDEX.md`](docs/INDEX.md) - documentation entry point
- [`docs/API.md`](docs/API.md) - API architecture and route surfaces
- [`docs/SCHEMA_BIBLE.md`](docs/SCHEMA_BIBLE.md) - schema map + source locations
- [`docs/UX_PRINCIPLES.md`](docs/UX_PRINCIPLES.md) - canonical UI/copy direction
- [`docs/DOC_SYNC.md`](docs/DOC_SYNC.md) - required doc + memory sync protocol
- [`docs/CHANGE_NOTES.md`](docs/CHANGE_NOTES.md) - concise architecture change log

Documentation workflow commands:
- `bun run docs:check` - fail if code-like changes exist without `docs/*.md` updates
- `bun run docs:sync:mind` - mirror canonical code docs into mind vault (`/Users/ameer/bizing/mind/workspace/body`)

Deep schema sources:
- [`packages/db/SCHEMA_BIBLE.md`](packages/db/SCHEMA_BIBLE.md)
- [`packages/db/src/schema/SCHEMA.md`](packages/db/src/schema/SCHEMA.md)

Saga testing docs:
- [`testing/sagas/README.md`](testing/sagas/README.md)
- [`testing/sagas/docs/API_CONTRACT.md`](testing/sagas/docs/API_CONTRACT.md)

Mind workspace (outside repo, Obsidian vault):
- `/Users/ameer/bizing/mind`

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run API tests
pnpm --filter @bizing/api test

# Run admin tests
pnpm --filter @bizing/admin test
```

## 📦 Building

```bash
# Build all packages
pnpm build

# Build specific app
pnpm --filter @bizing/api build
pnpm --filter @bizing/admin build
```

## 🚀 Deployment

See [DEPLOYMENT.md]() for production deployment instructions.

---

Built with ❤️ for the AI age.
