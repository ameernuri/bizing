import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'
config({ path: '../../.env' })

export default defineConfig({
  schema: ['./src/schema/*.ts'],
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/biz.ing'
  } as any,
  verbose: true,
  strict: false
})
