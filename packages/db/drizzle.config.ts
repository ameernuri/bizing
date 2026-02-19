import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/schema/*.ts"],
  out: "./migrations",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://user:password@localhost:5432/bizing",
  } as any,
  verbose: true,
  strict: false,
});
