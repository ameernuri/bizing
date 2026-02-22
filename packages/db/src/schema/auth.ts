/**
 * Better Auth schema aggregator.
 *
 * Auth tables are split into focused modules so each table is easy to locate:
 * - `./auth/sessions`
 * - `./auth/accounts`
 * - `./auth/verifications`
 * - `./auth/members`
 * - `./auth/invitations`
 *
 * Keep this file as the stable import entrypoint used by `@bizing/db`.
 */

export { sessions } from "./auth/sessions";
export { accounts } from "./auth/accounts";
export { verifications } from "./auth/verifications";
export { members } from "./auth/members";
export { invitations } from "./auth/invitations";

import { sessions } from "./auth/sessions";
import { accounts } from "./auth/accounts";
import { verifications } from "./auth/verifications";
import { members } from "./auth/members";
import { invitations } from "./auth/invitations";

/**
 * Convenience schema object for Better Auth drizzle adapter usage:
 * `schema: { ...authSchema, users, bizes }`
 */
export const authSchema = {
  sessions,
  accounts,
  verifications,
  members,
  invitations,
};
