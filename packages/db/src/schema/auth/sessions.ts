import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "../users";

/**
 * sessions
 *
 * Better Auth session persistence.
 * One row = one active/expired login session token.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => ({
    sessionsUserIdIdx: index("sessions_user_id_idx").on(table.userId),
  }),
);
