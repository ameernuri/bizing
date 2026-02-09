import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: ['./src/db/schema/*.ts'],
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/biz.ing'
  },
  verbose: true,
  strict: true
})
