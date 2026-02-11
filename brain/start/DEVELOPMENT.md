# biz.ing - Development Setup Guide

## Running the Project

### Prerequisites
- Node.js 20+
- pnpm 9+

### Installation
```bash
cd ~/projects/biz.ing
pnpm install
```

### Running Servers

**Terminal 1 - API Server:**
```bash
cd apps/api
npx tsx src/server.ts
```
- **API:** http://localhost:6000
- **API Docs:** http://localhost:6000/reference (interactive testing!)
- **OpenAPI Spec:** http://localhost:6000/doc

**Terminal 2 - Admin Dashboard:**
```bash
cd apps/admin
npm run dev
```
- **Admin:** http://localhost:9000
- **Frontend Logs:** Bottom-right overlay

## Features Implemented

### 1. Interactive API Documentation
Visit http://localhost:6000/reference to:
- Browse all API endpoints
- Test endpoints directly in browser
- See request/response schemas
- Make live API calls

### 2. Structured Logging (Backend)
All API requests are logged with:
- Timestamp
- Log level (debug/info/warn/error)
- Request ID (for tracing)
- Duration
- Request method & path
- Error details

**Log Format:**
```
[16:57:16] [INFO]  [abc12345] GET /health
[16:57:17] [DEBUG] [abc12345] POST /api/v1/auth/login
[16:57:18] [INFO]  [abc12345] Login successful
```

### 3. Frontend Log Overlay
In the admin dashboard:
- Bottom-right corner shows live logs
- Color-coded by level (debug/info/warn/error)
- Filterable by level
- Scrollable history (last 100 logs)
- Clear button to reset

### 4. Request Tracking
Every request gets a unique Request ID for tracing through the system:
- Included in all responses
- Logged with every operation
- Helps debug distributed requests

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with stats |
| GET | `/api/demo` | Demo endpoint |
| GET | `/api/v1/bookings` | List bookings |
| GET | `/api/v1/stats` | Dashboard stats |
| GET | `/api/v1/products` | List products |
| POST | `/api/v1/auth/register` | Register organization |
| POST | `/api/v1/auth/login` | Login |

## Project Structure

```
biz.ing/
├── apps/
│   ├── api/                    # Hono API Server
│   │   └── src/
│   │       └── server.ts       # Main server with routes
│   │                           # + logging, CORS, docs
│   │
│   └── admin/                  # Next.js Admin
│       └── src/
│           └── app/
│               └── page.tsx     # Dashboard + log overlay
│
├── packages/
│   ├── db/                    # Drizzle ORM
│   └── schema/                 # Zod schemas
│
└── doc/                        # Documentation
```

## Next Steps
1. Add actual database connection
2. Implement Better Auth
3. Add Stripe integration
4. Build real booking/product CRUD
5. Add unit/integration tests

---

Built with ❤️ for the AI age.
