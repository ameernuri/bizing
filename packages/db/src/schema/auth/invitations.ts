import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { bizes } from "../bizes";
import { users } from "../users";

/**
 * invitations
 *
 * Better Auth organization invitations.
 * Note: organization_id points to local `bizes.id` (orgs are modeled as bizes).
 */
export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => bizes.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    invitationsOrganizationIdIdx: index("invitations_organization_id_idx").on(
      table.organizationId,
    ),
    invitationsEmailIdx: index("invitations_email_idx").on(table.email),
  }),
);
