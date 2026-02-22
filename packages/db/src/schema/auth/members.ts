import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { bizes } from "../bizes";
import { users } from "../users";

/**
 * members
 *
 * Better Auth organization membership rows.
 * Note: organization_id points to local `bizes.id` (orgs are modeled as bizes).
 */
export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => bizes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    membersOrganizationIdIdx: index("members_organization_id_idx").on(
      table.organizationId,
    ),
    membersUserIdIdx: index("members_user_id_idx").on(table.userId),
  }),
);
