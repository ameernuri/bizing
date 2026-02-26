import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// Common utilities
export * from './schema/_common'
export * from './schema/enums'

// Schema exports
export * from './schema/bizes'
export * from './schema/users'
export * from './schema/locations'
export * from './schema/group_accounts'
export * from './schema/memberships'
export * from './schema/services'
export * from './schema/products'
export * from './schema/service_products'
export * from './schema/biz_configs'
export * from './schema/auth'
export * from './schema/assets'
export * from './schema/venues'
export * from './schema/resources'
export * from './schema/stripe'
export * from './schema/social_graph'
export * from './schema/api_credentials'
export * from './schema/ref_keys'
export * from './schema/sagas'
/**
 * Canonical booking architecture.
 *
 * v0 policy:
 * - no backwards-compatibility shims
 * - no duplicated legacy booking domains
 * - all new API/domain work should use these tables directly
 */
export * from './schema/canonical'
export * as schemaCanonical from './schema/canonical'

import * as enumsSchema from './schema/enums'
import * as bizesSchema from './schema/bizes'
import * as usersSchema from './schema/users'
import * as locationsSchema from './schema/locations'
import * as groupAccountsSchema from './schema/group_accounts'
import * as membershipsSchema from './schema/memberships'
import * as servicesSchema from './schema/services'
import * as productsSchema from './schema/products'
import * as serviceProductsSchema from './schema/service_products'
import * as bizConfigsSchema from './schema/biz_configs'
import * as authSchema from './schema/auth'
import * as assetsSchema from './schema/assets'
import * as venuesSchema from './schema/venues'
import * as resourcesSchema from './schema/resources'
import * as stripeSchema from './schema/stripe'
import * as socialGraphSchema from './schema/social_graph'
import * as apiCredentialsSchema from './schema/api_credentials'
import * as sagasSchema from './schema/sagas'
import * as canonicalSchemaModules from './schema/canonical'

/**
 * Shared core models used by canonical booking domains.
 */
const schemaCore = {
  ...enumsSchema,
  ...bizesSchema,
  ...usersSchema,
  ...locationsSchema,
  ...groupAccountsSchema,
  ...membershipsSchema,
  ...servicesSchema,
  ...productsSchema,
  ...serviceProductsSchema,
  ...bizConfigsSchema,
  ...authSchema,
  ...assetsSchema,
  ...venuesSchema,
  ...resourcesSchema,
  ...stripeSchema,
  ...socialGraphSchema,
  ...apiCredentialsSchema,
  ...sagasSchema,
}

/**
 * Unified active Drizzle schema registry.
 *
 * Order is intentional:
 * 1) core shared models
 * 2) canonical booking modules
 */
const schema = {
  ...schemaCore,
  ...canonicalSchemaModules,
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize @bizing/db')
}

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })

export async function checkDatabaseConnection(): Promise<boolean> {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
    return true
  } finally {
    client.release()
  }
}

const dbPackage = {
  db,
  pool,
  checkDatabaseConnection,
  authSchema: authSchema.authSchema,
  bizes: bizesSchema.bizes,
  members: authSchema.members,
  invitations: authSchema.invitations,
  sessions: authSchema.sessions,
  accounts: authSchema.accounts,
  verifications: authSchema.verifications,
  locations: locationsSchema.locations,
  resources: resourcesSchema.resources,
  bookingOrders: canonicalSchemaModules.bookingOrders,
  bookingOrderLines: canonicalSchemaModules.bookingOrderLines,
  offers: canonicalSchemaModules.offers,
  offerVersions: canonicalSchemaModules.offerVersions,
  paymentProcessorAccounts: canonicalSchemaModules.paymentProcessorAccounts,
  paymentMethods: canonicalSchemaModules.paymentMethods,
  paymentIntents: canonicalSchemaModules.paymentIntents,
  paymentIntentEvents: canonicalSchemaModules.paymentIntentEvents,
  paymentIntentTenders: canonicalSchemaModules.paymentIntentTenders,
  paymentIntentLineAllocations: canonicalSchemaModules.paymentIntentLineAllocations,
  paymentTransactions: canonicalSchemaModules.paymentTransactions,
  paymentTransactionLineAllocations: canonicalSchemaModules.paymentTransactionLineAllocations,
  queues: canonicalSchemaModules.queues,
  queueEntries: canonicalSchemaModules.queueEntries,
  channelAccounts: canonicalSchemaModules.channelAccounts,
  channelSyncStates: canonicalSchemaModules.channelSyncStates,
  channelEntityLinks: canonicalSchemaModules.channelEntityLinks,
  channelSyncJobs: canonicalSchemaModules.channelSyncJobs,
  channelSyncItems: canonicalSchemaModules.channelSyncItems,
  graphIdentities: socialGraphSchema.graphIdentities,
  graphSubjectSubscriptions: socialGraphSchema.graphSubjectSubscriptions,
  graphIdentityNotificationEndpoints: socialGraphSchema.graphIdentityNotificationEndpoints,
  subjects: canonicalSchemaModules.subjects,
  transportRoutes: canonicalSchemaModules.transportRoutes,
  transportTrips: canonicalSchemaModules.transportTrips,
  dispatchTasks: canonicalSchemaModules.dispatchTasks,
  demandSignalDefinitions: canonicalSchemaModules.demandSignalDefinitions,
  demandSignalObservations: canonicalSchemaModules.demandSignalObservations,
  demandPricingPolicies: canonicalSchemaModules.demandPricingPolicies,
  demandPricingPolicySignals: canonicalSchemaModules.demandPricingPolicySignals,
  demandPricingPolicyTiers: canonicalSchemaModules.demandPricingPolicyTiers,
  demandPricingEvaluations: canonicalSchemaModules.demandPricingEvaluations,
  demandPricingApplications: canonicalSchemaModules.demandPricingApplications,
  users: usersSchema.users,
  apiCredentials: apiCredentialsSchema.apiCredentials,
  apiAccessTokens: apiCredentialsSchema.apiAccessTokens,
  sagaDefinitions: sagasSchema.sagaDefinitions,
  sagaDefinitionRevisions: sagasSchema.sagaDefinitionRevisions,
  sagaRuns: sagasSchema.sagaRuns,
  sagaRunSteps: sagasSchema.sagaRunSteps,
  sagaRunArtifacts: sagasSchema.sagaRunArtifacts,
  sagaRunActorProfiles: sagasSchema.sagaRunActorProfiles,
  sagaRunActorMessages: sagasSchema.sagaRunActorMessages,
  sagaUseCases: sagasSchema.sagaUseCases,
  sagaUseCaseVersions: sagasSchema.sagaUseCaseVersions,
  sagaPersonas: sagasSchema.sagaPersonas,
  sagaPersonaVersions: sagasSchema.sagaPersonaVersions,
  sagaDefinitionLinks: sagasSchema.sagaDefinitionLinks,
  sagaCoverageReports: sagasSchema.sagaCoverageReports,
  sagaCoverageItems: sagasSchema.sagaCoverageItems,
  sagaTags: sagasSchema.sagaTags,
  sagaTagBindings: sagasSchema.sagaTagBindings,
  authzPermissionDefinitions: canonicalSchemaModules.authzPermissionDefinitions,
  authzRoleDefinitions: canonicalSchemaModules.authzRoleDefinitions,
  authzRolePermissions: canonicalSchemaModules.authzRolePermissions,
  authzMembershipRoleMappings: canonicalSchemaModules.authzMembershipRoleMappings,
  authzRoleAssignments: canonicalSchemaModules.authzRoleAssignments,
}

export default dbPackage
