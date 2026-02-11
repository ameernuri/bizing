# biz.ing Monorepo Setup Guide

**Date:** February 8, 2026
**Status:** Installation & Structure Plan

---

## 1. Project Structure

```
biz.ing/
├── apps/
│   ├── api/                    # Hono API Server (Node.js)
│   │   ├── src/
│   │   │   ├── routes/         # API route handlers
│   │   │   │   ├── v1/         # Versioned API
│   │   │   │   │   ├── auth/
│   │   │   │   │   ├── bookings/
│   │   │   │   │   ├── products/
│   │   │   │   │   ├── events/
│   │   │   │   │   ├── customers/
│   │   │   │   │   ├── payments/
│   │   │   │   │   └── admin/
│   │   │   │   ├── client/     # Public client API
│   │   │   │   └── admin/      # Admin API
│   │   │   ├── middleware/     # Hono middleware
│   │   │   │   ├── auth.ts
│   │   │   │   ├── tenant.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── cors.ts
│   │   │   ├── lib/           # Utilities
│   │   │   │   ├── errors.ts
│   │   │   │   ├── logger.ts
│   │   │   │   └── openapi.ts
│   │   │   ├── socket/        # Socket.io handlers
│   │   │   │   ├── index.ts
│   │   │   │   └── events/
│   │   │   ├── db/           # Database connection
│   │   │   │   └── index.ts
│   │   │   └── index.ts       # App entry point
│   │   ├── test/             # API tests
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── .env.example
│   │
│   ├── admin/                 # Next.js Admin Dashboard
│   │   ├── src/
│   │   │   ├── app/          # Next.js App Router
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/
│   │   │   │   │   └── register/
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── bookings/
│   │   │   │   │   ├── customers/
│   │   │   │   │   ├── products/
│   │   │   │   │   ├── events/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── analytics/
│   │   │   │   └── api/        # Server actions
│   │   │   ├── components/    # React components
│   │   │   │   ├── ui/        # shadcn/ui
│   │   │   │   ├── bookings/
│   │   │   │   ├── products/
│   │   │   │   └── layout/
│   │   │   ├── hooks/         # Custom hooks
│   │   │   ├── lib/           # Utilities
│   │   │   │   ├── api-client.ts
│   │   │   │   └── auth.ts
│   │   │   ├── types/         # TypeScript types
│   │   │   └── stores/        # State management
│   │   ├── public/            # Static assets
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── .env.example
│   │
│   └── web/                   # Customer-Facing Website (future)
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   └── lib/
│       └── package.json
│
├── packages/
│   ├── db/                    # Drizzle ORM + Database
│   │   ├── src/
│   │   │   ├── schema/        # Table definitions
│   │   │   │   ├── _common.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── orgs.ts
│   │   │   │   ├── locations.ts
│   │   │   │   ├── services.ts
│   │   │   │   ├── bookings.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── events.ts
│   │   │   │   ├── customers.ts
│   │   │   │   ├── payments.ts
│   │   │   │   ├── subscriptions.ts
│   │   │   │   ├── files.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── coupons.ts
│   │   │   │   └── webhooks.ts
│   │   │   ├── migrations/    # Migration files
│   │   │   ├── seed/         # Seed data
│   │   │   └── index.ts      # Exports
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── auth/                  # Better Auth Configuration
│   │   ├── src/
│   │   │   ├── index.ts       # Auth setup
│   │   │   ├── plugins/       # Custom plugins
│   │   │   │   ├── organizations.ts
│   │   │   │   └── api-keys.ts
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── schema/                 # Zod Schemas (Shared)
│   │   ├── src/
│   │   │   ├── _shared.ts
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── orgs.ts
│   │   │   ├── bookings.ts
│   │   │   ├── products.ts
│   │   │   ├── events.ts
│   │   │   ├── customers.ts
│   │   │   ├── payments.ts
│   │   │   ├── subscriptions.ts
│   │   │   └── api.ts        # API response schemas
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api-client/            # Generated API Client
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── errors.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                    # Shared UI Components
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── form.tsx
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tailwind.config.ts
│   │
│   ├── tsconfig/              # Shared TypeScript
│   │   ├── base.json
│   │   ├── react.json
│   │   └── node.json
│   │
│   └── eslint/                # Shared ESLint
│       ├── base.js
│       └── package.json
│
├── scripts/
│   ├── generate-api.ts        # Generate API client
│   ├── migrate.ts             # Run migrations
│   ├── seed.ts                # Seed database
│   └── build-docs.ts          # Build API docs
│
├── turbo.json                 # Turborepo config
├── pnpm-workspace.yaml        # pnpm workspace
├── package.json               # Root package.json
├── tsconfig.json              # Root TS config
├── .env.example               # Environment template
├── .gitignore
└── README.md
```

---

## 2. Root package.json

```json
{
  "name": "biz.ing",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,md}\"",
    "db:migrate": "pnpm --filter @biz.ing/db migrate",
    "db:seed": "pnpm --filter @biz.ing/db seed",
    "api:generate": "tsx scripts/generate-api.ts"
  },
  "devDependencies": {
    "turbo": "latest",
    "prettier": "latest",
    "typescript": "latest",
    "@types/node": "latest"
  },
  "packageManager": "pnpm@9.x"
}
```

---

## 3. Installation Commands

### 3.1 Initialize pnpm workspace

```bash
# Create project directory
mkdir biz.ing
cd biz.ing
git init

# Initialize pnpm
pnpm init -w

# Install Turborepo
pnpm add -Dw turbo

# Install TypeScript
pnpm add -Dw typescript @types/node
```

### 3.2 Install Core Dependencies

```bash
# Root level
pnpm add -Dw turbo prettier eslint
```

### 3.3 API App (apps/api)

```bash
cd apps/api
pnpm init

# Hono + Node.js
pnpm add hono @hono/node-server @hono/zod-openapi

# Database
pnpm add drizzle-orm drizzle-zod
pnpm add -D drizzle-kit

# Auth
pnpm add better-auth

# Real-time
pnpm add socket.io

# Validation & Types
pnpm add zod zod-to-ts
pnpm add -D @types/node

# Utilities
pnpm add bcryptjs jsonwebtoken uuid
pnpm add -D @types/bcryptjs @types/jsonwebtoken @types/uuid

# Logging
pnpm add pino pino-pretty

# Testing
pnpm add -D vitest supertest @types/supertest
```

### 3.4 Admin App (apps/admin)

```bash
cd apps/admin
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm

# Install dependencies
pnpm add @tanstack/react-query @tanstack/react-table
pnpm add zod react-hook-form @hookform/resolvers
pnpm add lucide-react date-fns clsx tailwind-merge
pnpm add recharts

# shadcn/ui (after Next.js setup)
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input select dialog table form card badge toast dropdown-menu avatar tabs tooltip popover sheet navigation-menu

# API Client (will be generated)
pnpm add @biz.ing/api-client
pnpm add @biz.ing/ui @biz.ing/schema
```

### 3.5 Database Package (packages/db)

```bash
mkdir -p packages/db/src/{schema,migrations,seed}
cd packages/db
pnpm init

pnpm add drizzle-orm
pnpm add -D drizzle-kit typescript @types/node

# Database driver
pnpm add pg
pnpm add -D @types/pg

# For migrations
pnpm add tsx
```

### 3.6 Auth Package (packages/auth)

```bash
cd packages/auth
pnpm init

pnpm add better-auth
pnpm add -D typescript @types/node
```

### 3.7 Schema Package (packages/schema)

```bash
cd packages/schema
pnpm init

pnpm add zod
pnpm add -D typescript @types/node
```

### 3.8 API Client Package (packages/api-client)

```bash
cd packages/api-client
pnpm init

pnpm add zod
pnpm add -D typescript @types/node

# For code generation
pnpm add -D @openapitools/openapi-generator-cli
```

### 3.9 UI Package (packages/ui)

```bash
cd packages/ui
pnpm init

pnpm add tailwindcss postcss autoprefixer
pnpm add -D typescript @types/node

# shadcn/ui dependencies
pnpm add clsx tailwind-merge lucide-react
```

---

## 4. Configuration Files

### 4.1 pnpm-workspace.yaml

```yaml
packages:
  - apps/*
  - packages/*
```

### 4.2 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "outputs": ["coverage/**"]
    },
    "db:generate": {
      "dependsOn": ["@biz.ing/db:build"]
    },
    "db:migrate": {
      "dependsOn": ["@biz.ing/db:generate"]
    }
  }
}
```

### 4.3 tsconfig/base.json

```json
{
  "$schema": "https://www.typescriptlang.org/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "jsx": "preserve"
  }
}
```

---

## 5. Package.json Reference

### apps/api/package.json

```json
{
  "name": "@biz.ing/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext ts",
    "test": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/zod-openapi": "^0.1.0",
    "@hono/node-server": "^0.1.0",
    "better-auth": "^1.0.0",
    "socket.io": "^4.0.0",
    "drizzle-orm": "^0.30.0",
    "drizzle-zod": "^0.20.0",
    "zod": "^3.22.0",
    "pg": "^8.0.0",
    "bcryptjs": "^2.4.0",
    "jsonwebtoken": "^9.0.0",
    "uuid": "^9.0.0",
    "pino": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/uuid": "^9.0.0",
    "@types/pg": "^8.0.0",
    "vitest": "^1.0.0",
    "supertest": "^6.0.0",
    "tsx": "^4.0.0",
    "drizzle-kit": "^0.20.0",
    "eslint": "^8.0.0"
  }
}
```

### packages/db/package.json

```json
{
  "name": "@biz.ing/db",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx scripts/seed.ts",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "pg": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/pg": "^8.0.0",
    "tsx": "^4.0.0",
    "drizzle-kit": "^0.20.0"
  }
}
```

### packages/schema/package.json

```json
{
  "name": "@biz.ing/schema",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src --ext ts"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 6. Environment Variables

### .env.example

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/biz.ing"

# Auth
AUTH_SECRET="your-auth-secret-here-min-32-chars"
BETTER_AUTH_URL="http://localhost:6000"

# API
API_URL="http://localhost:6000"
API_SECRET="your-api-secret"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."

# PayPal
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."
PAYPAL_MODE="sandbox"

# Twilio
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="..."

# File Storage (S3-compatible)
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_BUCKET="biz.ing-uploads"
S3_REGION="us-east-1"
S3_ENDPOINT="https://s3.amazonaws.com"

# Email
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASSWORD="..."
FROM_EMAIL="noreply@bizing.me"

# Redis (for caching/sessions)
REDIS_URL="redis://localhost:6379"

# App
NODE_ENV="development"
FRONTEND_URL="http://localhost:9000"
```

---

## 7. Getting Started Commands

```bash
# 1. Clone and enter directory
cd biz.ing

# 2. Install all dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env

# 4. Setup database
# Make sure PostgreSQL is running
pnpm db:migrate

# 5. Seed demo data (optional)
pnpm db:seed

# 6. Start development servers
pnpm dev
```

---

## 8. Next Steps After Setup

1. **Define Database Schema** - Create Drizzle tables in `packages/db/src/schema/`
2. **Setup Zod Schemas** - Define validation in `packages/schema/src/`
3. **Configure Auth** - Setup Better Auth in `packages/auth/src/`
4. **Build API Routes** - Create endpoints in `apps/api/src/routes/`
5. **Generate API Client** - Run `pnpm api:generate`
6. **Build Admin UI** - Develop Next.js dashboard in `apps/admin/src/app/`

---

_Generated February 8, 2026_
_For biz.ing Development Team_
