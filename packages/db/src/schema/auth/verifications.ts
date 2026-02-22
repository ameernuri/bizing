import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * verifications
 *
 * Better Auth verification tokens (email verification, password reset, etc.).
 */
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    verificationsIdentifierIdx: index("verifications_identifier_idx").on(
      table.identifier,
    ),
  }),
);
