# **Bizing**

**Sell your services and digital products online, easily.**

A modern, API-first business platform for selling services, digital products, and managing bookings. Built with TypeScript, Next.js, and Hono.

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

- [VISION.md](VISION.md) - Project vision and scope
- [FEATURE_SPACE.md](FEATURE_SPACE.md) - Feature catalog
- [SCHEMA_DESIGN.md](SCHEMA_DESIGN.md) - Database schema
- [MONOREPO_SETUP.md](MONOREPO_SETUP.md) - Development setup
- [memory/](memory/) - Design exploration and decisions

### Memory Folder

The `memory/` folder is an **Obsidian vault** for design exploration and decisions:

| File/Folder              | Purpose                          |
| ------------------------ | -------------------------------- |
| `memory/`                | Design exploration and decisions |
| `memory/WORKFLOW.md`     | How work happens                 |
| `memory/RULES.md`        | Coding standards                 |
| `memory/DISTILLATION.md` | Lessons learned with links       |
| `memory/daily/`          | Daily notes (YYYY-MM-DD)         |

**Key Rules:**

- Work on a branch, never touch main directly
- Never commit without asking for confirmation
- Never push to main without approval
- Ask for clarification when ambiguous

See [memory/WORKFLOW.md](memory/WORKFLOW.md) for full guidelines.

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
