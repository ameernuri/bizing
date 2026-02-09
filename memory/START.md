# biz.ing - Quick Start Guide

## Running the Project

### 1. Install Dependencies

```bash
cd ~/projects/biz.ing
pnpm install --ignore-scripts
```

### 2. Start API Server

```bash
cd apps/api
node src/server.js
```

Server runs at http://localhost:6000

### 3. Start Admin Dashboard (separate terminal)

```bash
cd apps/admin
npm run dev
```

Admin runs at http://localhost:9000

## API Endpoints

- GET /health - Health check
- GET /api/demo - Demo
- GET /api/v1/bookings - Bookings list
- GET /api/v1/stats - Dashboard stats

## Project Structure

```
biz.ing/
├── apps/
│   ├── api/      # Hono API server
│   └── admin/    # Next.js dashboard
├── packages/
│   ├── db/       # Drizzle ORM
│   └── schema/   # Zod schemas
└── doc/          # Documentation
```
