# 🚀 START

> Get bizing running locally. Updated 2026-02-11.

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (optional for now - mock mode works)

## Installation

```bash
# Navigate to project
cd ~/projects/bizing

# Install dependencies
pnpm install --ignore-scripts
```

## Running Development

### Terminal 1: API Server

```bash
cd apps/api
npx tsx src/server.ts
```

- **API:** http://localhost:6129
- **API Docs:** http://localhost:6129/reference
- **OpenAPI Spec:** http://localhost:6129/doc

### Terminal 2: Admin Dashboard

```bash
cd apps/admin
pnpm dev
```

- **Admin:** http://localhost:9000

## Project Structure

```
bizing/
├── apps/
│   ├── api/           # Hono API server (port 6129)
│   └── admin/         # Next.js dashboard (port 9000)
├── packages/
│   ├── db/            # Drizzle ORM schemas
│   ├── schema/        # Zod validation schemas
│   ├── auth/          # Better Auth config
│   └── ui/            # Shared UI components
├── brain/             # 🧠 Project memory (you are here!)
└── .obsidian/         # Obsidian vault config
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/auth/register` | Register organization |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/products` | List products (mock) |

*Note: Most endpoints return mock data until database is connected.*

## Next Steps

1. Read [[STATUS]] - understand current state
2. Read [[GOALS]] - see what needs building
3. Read [[01-design/VISION]] - understand the product
4. Check [[03-operations/WORKFLOW]] - how we work

## Troubleshooting

**Port 6129 blocked?**
- API uses 6129 because 6000 is blocked by browsers
- Change in `apps/api/src/server.ts` if needed

**Type errors?**
```bash
cd apps/api && pnpm tsc --noEmit
cd apps/admin && pnpm tsc --noEmit
```

---

## Related

- [[STATUS]] - Current project state
- [[GOALS]] - What we're building
- [[DEVELOPMENT]] - Detailed dev guide
- [[01-design/VISION]] - Product vision

---
*Last updated: 2026-02-11*
