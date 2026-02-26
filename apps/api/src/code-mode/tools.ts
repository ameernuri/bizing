/**
 * Agents tool registry.
 *
 * These tools are intentionally API-first:
 * - Each tool maps to one HTTP endpoint in this service.
 * - Tools never expose SQL/table-level execution.
 */

export type ApiToolMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiToolDefinition = {
  name: string
  description: string
  method: ApiToolMethod
  path: string
  tags: string[]
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const apiTools: ApiToolDefinition[] = [
  {
    name: 'bizing.bizes.list',
    description: 'List bizes available to the authenticated user.',
    method: 'GET',
    path: '/api/v1/bizes',
    tags: ['bizes'],
    parameters: {
      type: 'object',
      properties: {
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
        status: { type: 'string' },
        type: { type: 'string' },
      },
    },
  },
  {
    name: 'bizing.bizes.create',
    description: 'Create a biz and make current user owner.',
    method: 'POST',
    path: '/api/v1/bizes',
    tags: ['bizes'],
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        type: { type: 'string' },
        timezone: { type: 'string' },
        currency: { type: 'string' },
      },
      required: ['name', 'slug'],
    },
  },
  {
    name: 'bizing.auth.me',
    description: 'Get authenticated user context, memberships, active biz, and effective permissions.',
    method: 'GET',
    path: '/api/v1/auth/me',
    tags: ['auth', 'acl'],
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'bizing.auth.switchActiveBiz',
    description: 'Switch active biz context for the current session.',
    method: 'PATCH',
    path: '/api/v1/auth/active-biz',
    tags: ['auth'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.auth.apiKeys.list',
    description: 'List machine API keys owned by current user.',
    method: 'GET',
    path: '/api/v1/auth/api-keys',
    tags: ['auth', 'machine'],
    parameters: {
      type: 'object',
      properties: {
        includeRevoked: { type: 'boolean', default: false },
        bizId: { type: 'string' },
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'bizing.auth.apiKeys.create',
    description: 'Create one machine API key (raw secret returned once).',
    method: 'POST',
    path: '/api/v1/auth/api-keys',
    tags: ['auth', 'machine'],
    parameters: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        description: { type: 'string' },
        bizId: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        expiresAt: { type: 'string', description: 'ISO datetime' },
        allowDirectApiKeyAuth: { type: 'boolean', default: false },
        metadata: { type: 'object' },
      },
      required: ['label'],
    },
  },
  {
    name: 'bizing.auth.apiKeys.revoke',
    description: 'Revoke one API key and all child short-lived tokens.',
    method: 'POST',
    path: '/api/v1/auth/api-keys/{apiCredentialId}/revoke',
    tags: ['auth', 'machine'],
    parameters: {
      type: 'object',
      properties: {
        apiCredentialId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['apiCredentialId'],
    },
  },
  {
    name: 'bizing.auth.tokens.exchange',
    description:
      'Exchange an API key for a short-lived bearer token. Supports session + apiCredentialId or direct x-api-key auth.',
    method: 'POST',
    path: '/api/v1/auth/tokens/exchange',
    tags: ['auth', 'machine'],
    parameters: {
      type: 'object',
      properties: {
        apiCredentialId: { type: 'string' },
        apiKey: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        ttlSeconds: { type: 'number', default: 900 },
        bizId: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
  {
    name: 'bizing.auth.tokens.revoke',
    description: 'Revoke one short-lived machine access token.',
    method: 'POST',
    path: '/api/v1/auth/tokens/{tokenId}/revoke',
    tags: ['auth', 'machine'],
    parameters: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['tokenId'],
    },
  },
  {
    name: 'bizing.acl.biz.roles.list',
    description: 'List ACL role definitions available to one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/acl/roles',
    tags: ['acl', 'biz'],
    parameters: {
      type: 'object',
      properties: { bizId: { type: 'string' } },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.acl.biz.roles.create',
    description: 'Create biz/location/resource/subject scoped ACL role definition.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/acl/roles',
    tags: ['acl', 'biz'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        roleKey: { type: 'string' },
        name: { type: 'string' },
        scopeType: { type: 'string', enum: ['biz', 'location', 'resource', 'subject'] },
        locationId: { type: 'string' },
        resourceId: { type: 'string' },
        scopeSubjectType: { type: 'string' },
        scopeSubjectId: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['bizId', 'roleKey', 'name'],
    },
  },
  {
    name: 'bizing.acl.biz.rolePermissions.replace',
    description: 'Replace/update one biz role permission set.',
    method: 'PUT',
    path: '/api/v1/bizes/{bizId}/acl/roles/{roleId}/permissions',
    tags: ['acl', 'biz'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        roleId: { type: 'string' },
        permissions: { type: 'array', items: { type: 'object' } },
      },
      required: ['bizId', 'roleId', 'permissions'],
    },
  },
  {
    name: 'bizing.acl.biz.assignments.create',
    description: 'Assign ACL role to a user at biz/location/resource/subject scope.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/acl/assignments',
    tags: ['acl', 'biz'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        userId: { type: 'string' },
        roleDefinitionId: { type: 'string' },
        scopeType: { type: 'string', enum: ['biz', 'location', 'resource', 'subject'] },
        locationId: { type: 'string' },
        resourceId: { type: 'string' },
        scopeSubjectType: { type: 'string' },
        scopeSubjectId: { type: 'string' },
      },
      required: ['bizId', 'userId', 'roleDefinitionId'],
    },
  },
  {
    name: 'bizing.acl.biz.mappings.replace',
    description: 'Replace membership role -> ACL role mappings for one biz.',
    method: 'PUT',
    path: '/api/v1/bizes/{bizId}/acl/membership-mappings',
    tags: ['acl', 'biz'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        mappings: { type: 'array', items: { type: 'object' } },
      },
      required: ['bizId', 'mappings'],
    },
  },
  {
    name: 'bizing.acl.platform.roles.list',
    description: 'List platform-level ACL role templates.',
    method: 'GET',
    path: '/api/v1/platform/acl/roles',
    tags: ['acl', 'platform'],
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'bizing.acl.platform.permissions.list',
    description: 'List global ACL permission definitions.',
    method: 'GET',
    path: '/api/v1/platform/acl/permissions',
    tags: ['acl', 'platform'],
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'bizing.acl.platform.assignments.create',
    description: 'Assign a platform ACL role to a user.',
    method: 'POST',
    path: '/api/v1/platform/acl/assignments',
    tags: ['acl', 'platform'],
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        roleDefinitionId: { type: 'string' },
      },
      required: ['userId', 'roleDefinitionId'],
    },
  },
  {
    name: 'bizing.locations.list',
    description: 'List locations for one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/locations',
    tags: ['locations'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.locations.create',
    description: 'Create location in one biz.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/locations',
    tags: ['locations'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        type: { type: 'string' },
        timezone: { type: 'string' },
      },
      required: ['bizId', 'name', 'slug'],
    },
  },
  {
    name: 'bizing.resources.list',
    description: 'List resources for one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/resources',
    tags: ['resources'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        type: { type: 'string' },
        locationId: { type: 'string' },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.resources.create',
    description: 'Create resource in one biz.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/resources',
    tags: ['resources'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        locationId: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
      },
      required: ['bizId', 'locationId', 'type', 'name', 'slug'],
    },
  },
  {
    name: 'bizing.integrations.channelAccounts.list',
    description: 'List external integration channel accounts for one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/channel-accounts',
    tags: ['integrations', 'channels'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        provider: { type: 'string' },
        status: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.integrations.channelAccounts.create',
    description: 'Create one external integration channel account in a biz.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/channel-accounts',
    tags: ['integrations', 'channels'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        provider: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string' },
        providerAccountRef: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        authConfig: { type: 'object' },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'provider', 'name'],
    },
  },
  {
    name: 'bizing.integrations.channelSyncStates.list',
    description: 'List channel sync states (cursor/sync health checkpoints).',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/channel-sync-states',
    tags: ['integrations', 'channels', 'sync'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        channelAccountId: { type: 'string' },
        objectType: { type: 'string' },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.integrations.channelSyncStates.upsert',
    description: 'Create or update channel sync checkpoint state for one account/object type.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/channel-sync-states',
    tags: ['integrations', 'channels', 'sync'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        channelAccountId: { type: 'string' },
        objectType: { type: 'string' },
        direction: { type: 'string' },
        inboundCursor: { type: 'string' },
        outboundCursor: { type: 'string' },
        lastFailure: { type: 'string' },
        lastAttemptAt: { type: 'string' },
        lastSuccessAt: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'channelAccountId', 'objectType', 'direction'],
    },
  },
  {
    name: 'bizing.integrations.channelEntityLinks.list',
    description: 'List local-to-external ID mappings for channels.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/channel-entity-links',
    tags: ['integrations', 'channels', 'external-id'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        channelAccountId: { type: 'string' },
        objectType: { type: 'string' },
        isActive: { type: 'boolean' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.integrations.channelEntityLinks.create',
    description: 'Create one external ID mapping row for channel sync tracking.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/channel-entity-links',
    tags: ['integrations', 'channels', 'external-id'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        channelAccountId: { type: 'string' },
        objectType: { type: 'string' },
        offerVersionId: { type: 'string' },
        bookingOrderId: { type: 'string' },
        resourceId: { type: 'string' },
        customerUserId: { type: 'string' },
        localReferenceKey: { type: 'string' },
        externalObjectId: { type: 'string' },
        externalParentId: { type: 'string' },
        syncHash: { type: 'string' },
        isActive: { type: 'boolean' },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'channelAccountId', 'objectType', 'externalObjectId'],
    },
  },
  {
    name: 'bizing.offers.list',
    description: 'List offers for one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/offers',
    tags: ['offers'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        status: { type: 'string' },
        executionMode: { type: 'string' },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.offers.create',
    description: 'Create offer in one biz.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/offers',
    tags: ['offers'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        executionMode: { type: 'string' },
      },
      required: ['bizId', 'name', 'slug'],
    },
  },
  {
    name: 'bizing.offers.createVersion',
    description: 'Create a new offer version.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/offers/{offerId}/versions',
    tags: ['offers', 'versions'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        offerId: { type: 'string' },
        version: { type: 'number' },
        durationMode: { type: 'string' },
        basePriceMinor: { type: 'number' },
      },
      required: ['bizId', 'offerId', 'version'],
    },
  },
  {
    name: 'bizing.public.offers.list',
    description: 'List publicly published offers for one biz (customer discovery surface).',
    method: 'GET',
    path: '/api/v1/public/bizes/{bizId}/offers',
    tags: ['offers', 'public'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.bookingOrders.list',
    description: 'List booking orders for one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/booking-orders',
    tags: ['booking-orders'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        status: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.bookingOrders.create',
    description: 'Create booking order in one biz.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/booking-orders',
    tags: ['booking-orders'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        offerId: { type: 'string' },
        offerVersionId: { type: 'string' },
        totalMinor: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['bizId', 'offerId', 'offerVersionId'],
    },
  },
  {
    name: 'bizing.public.bookingOrders.listMine',
    description: 'List authenticated customer bookings for one biz on the public booking surface.',
    method: 'GET',
    path: '/api/v1/public/bizes/{bizId}/booking-orders',
    tags: ['booking-orders', 'public'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        status: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.public.bookingOrders.create',
    description: 'Create customer booking on the public booking surface.',
    method: 'POST',
    path: '/api/v1/public/bizes/{bizId}/booking-orders',
    tags: ['booking-orders', 'public'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        offerId: { type: 'string' },
        offerVersionId: { type: 'string' },
        totalMinor: { type: 'number' },
        currency: { type: 'string' },
        requestedStartAt: { type: 'string', description: 'ISO datetime' },
        requestedEndAt: { type: 'string', description: 'ISO datetime' },
      },
      required: ['bizId', 'offerId', 'offerVersionId'],
    },
  },
  {
    name: 'bizing.queues.list',
    description: 'List queue/waitlist definitions for one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/queues',
    tags: ['queues', 'waitlist'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        locationId: { type: 'string' },
        status: { type: 'string', enum: ['active', 'paused', 'closed', 'archived'] },
        strategy: { type: 'string', enum: ['fifo', 'priority', 'weighted', 'fair_share'] },
        selfJoinOnly: { type: 'boolean' },
        search: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.queues.create',
    description: 'Create one queue/waitlist definition in a biz.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/queues',
    tags: ['queues', 'waitlist'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        locationId: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        strategy: { type: 'string', enum: ['fifo', 'priority', 'weighted', 'fair_share'] },
        status: { type: 'string', enum: ['active', 'paused', 'closed', 'archived'] },
        isSelfJoinEnabled: { type: 'boolean', default: true },
        policy: { type: 'object' },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'name', 'slug'],
    },
  },
  {
    name: 'bizing.queueEntries.list',
    description: 'List queue entries for one queue in one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/queues/{queueId}/entries',
    tags: ['queues', 'waitlist', 'queue-entries'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        queueId: { type: 'string' },
        status: { type: 'string' },
        customerUserId: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId', 'queueId'],
    },
  },
  {
    name: 'bizing.queueEntries.create',
    description: 'Create one queue entry (internal operator/admin flow).',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/queues/{queueId}/entries',
    tags: ['queues', 'waitlist', 'queue-entries'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        queueId: { type: 'string' },
        customerUserId: { type: 'string' },
        customerGroupAccountId: { type: 'string' },
        requestedOfferVersionId: { type: 'string' },
        priorityScore: { type: 'number', default: 0 },
        displayCode: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'queueId'],
    },
  },
  {
    name: 'bizing.queueEntries.update',
    description: 'Update one queue entry status/priority.',
    method: 'PATCH',
    path: '/api/v1/bizes/{bizId}/queues/{queueId}/entries/{queueEntryId}',
    tags: ['queues', 'waitlist', 'queue-entries'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        queueId: { type: 'string' },
        queueEntryId: { type: 'string' },
        status: { type: 'string' },
        priorityScore: { type: 'number' },
        estimatedWaitMin: { type: 'number' },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'queueId', 'queueEntryId'],
    },
  },
  {
    name: 'bizing.public.waitlist.queues.list',
    description: 'List public self-join queues for one biz (customer discovery).',
    method: 'GET',
    path: '/api/v1/public/bizes/{bizId}/queues',
    tags: ['queues', 'waitlist', 'public'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        locationId: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.public.waitlist.join',
    description: 'Join queue/waitlist as authenticated customer.',
    method: 'POST',
    path: '/api/v1/public/bizes/{bizId}/queues/{queueId}/entries',
    tags: ['queues', 'waitlist', 'public'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        queueId: { type: 'string' },
        requestedOfferVersionId: { type: 'string' },
        bookingOrderId: { type: 'string' },
        priorityScore: { type: 'number', default: 0 },
        displayCode: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'queueId'],
    },
  },
  {
    name: 'bizing.public.waitlist.mine',
    description: 'List my queue/waitlist entries for one queue.',
    method: 'GET',
    path: '/api/v1/public/bizes/{bizId}/queues/{queueId}/entries',
    tags: ['queues', 'waitlist', 'public'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        queueId: { type: 'string' },
        status: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId', 'queueId'],
    },
  },
  {
    name: 'bizing.pricing.demandPolicies.list',
    description: 'List demand-pricing policies for one biz.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/demand-pricing/policies',
    tags: ['pricing', 'demand-pricing'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        status: { type: 'string' },
        targetType: { type: 'string' },
        isEnabled: { type: 'boolean' },
        search: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
        sortBy: { type: 'string', enum: ['id', 'priority'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.pricing.demandPolicies.create',
    description: 'Create one demand-pricing policy row for a biz.',
    method: 'POST',
    path: '/api/v1/bizes/{bizId}/demand-pricing/policies',
    tags: ['pricing', 'demand-pricing'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        targetType: { type: 'string' },
        resourceId: { type: 'string' },
        serviceId: { type: 'string' },
        serviceProductId: { type: 'string' },
        offerId: { type: 'string' },
        offerVersionId: { type: 'string' },
        locationId: { type: 'string' },
        scoringMode: { type: 'string' },
        scoreFloor: { type: 'number' },
        scoreCeiling: { type: 'number' },
        defaultAdjustmentType: { type: 'string' },
        defaultApplyAs: { type: 'string' },
        defaultAdjustmentValue: { type: 'number' },
        minAdjustmentMinor: { type: 'number' },
        maxAdjustmentMinor: { type: 'number' },
        minFinalUnitPriceMinor: { type: 'number' },
        maxFinalUnitPriceMinor: { type: 'number' },
        cooldownMin: { type: 'number' },
        effectiveStartAt: { type: 'string' },
        effectiveEndAt: { type: 'string' },
        priority: { type: 'number' },
        isEnabled: { type: 'boolean' },
        policy: { type: 'object' },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'name'],
    },
  },
  {
    name: 'bizing.compliance.controls.get',
    description:
      'Read compliance controls snapshot for one biz (privacy scope, credential governance, audit chain counters).',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/compliance/controls',
    tags: ['compliance', 'privacy', 'credential', 'audit'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        includeCredentialSamples: { type: 'boolean', default: false },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.public.payments.advancedCheckout',
    description:
      'Execute advanced checkout for one customer booking (split tender, tip, and line allocations).',
    method: 'POST',
    path: '/api/v1/public/bizes/{bizId}/booking-orders/{bookingOrderId}/payments/advanced',
    tags: ['payments', 'public', 'split-tender'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        bookingOrderId: { type: 'string' },
        currency: { type: 'string' },
        tipMinor: { type: 'number', default: 0 },
        tenders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              methodType: { type: 'string' },
              allocatedMinor: { type: 'number' },
              provider: { type: 'string' },
              providerMethodRef: { type: 'string' },
              label: { type: 'string' },
              metadata: { type: 'object' },
            },
          },
        },
        metadata: { type: 'object' },
      },
      required: ['bizId', 'bookingOrderId', 'tenders'],
    },
  },
  {
    name: 'bizing.payments.intents.list',
    description: 'List payment intents in one biz with optional booking/status filters.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/payment-intents',
    tags: ['payments', 'intents'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        bookingOrderId: { type: 'string' },
        customerUserId: { type: 'string' },
        status: { type: 'string' },
        page: { type: 'number', default: 1 },
        perPage: { type: 'number', default: 20 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.payments.intents.get',
    description: 'Get one payment intent with split-tender rows and immutable transaction trail.',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/payment-intents/{paymentIntentId}',
    tags: ['payments', 'intents'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        paymentIntentId: { type: 'string' },
      },
      required: ['bizId', 'paymentIntentId'],
    },
  },
  {
    name: 'bizing.bookingOrders.updateStatus',
    description: 'Update booking order status.',
    method: 'PATCH',
    path: '/api/v1/bizes/{bizId}/booking-orders/{bookingOrderId}/status',
    tags: ['booking-orders'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        bookingOrderId: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['bizId', 'bookingOrderId', 'status'],
    },
  },
  {
    name: 'bizing.dispatch.state.get',
    description:
      'Read one biz dispatch/transport operational snapshot (tasks, trips, routes, upcoming window).',
    method: 'GET',
    path: '/api/v1/bizes/{bizId}/dispatch/state',
    tags: ['dispatch', 'transport', 'routes'],
    parameters: {
      type: 'object',
      properties: {
        bizId: { type: 'string' },
        lookaheadHours: { type: 'number', default: 72 },
        perEntityLimit: { type: 'number', default: 20 },
      },
      required: ['bizId'],
    },
  },
  {
    name: 'bizing.sagas.specs.list',
    description: 'List available saga definitions (file-synced test lifecycles).',
    method: 'GET',
    path: '/api/v1/sagas/specs',
    tags: ['sagas', 'specs'],
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        sync: { type: 'boolean' },
        limit: { type: 'number', default: 200 },
      },
    },
  },
  {
    name: 'bizing.sagas.specs.generate',
    description: 'Generate saga JSON specs from use-case + persona markdown sources.',
    method: 'POST',
    path: '/api/v1/sagas/specs/generate',
    tags: ['sagas', 'specs', 'generator'],
    parameters: {
      type: 'object',
      properties: {
        useCaseRefs: { type: 'array', items: { type: 'string' } },
        personaRefs: { type: 'array', items: { type: 'string' } },
        limitUseCases: { type: 'number' },
        maxPersonasPerUseCase: { type: 'number' },
        overwrite: { type: 'boolean', default: true },
        syncDefinitions: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'bizing.sagas.library.syncDocs',
    description:
      'Import and normalize use-cases/personas from markdown docs into DB loop tables, then link saga definitions.',
    method: 'POST',
    path: '/api/v1/sagas/library/sync-docs',
    tags: ['sagas', 'library', 'sync'],
    parameters: {
      type: 'object',
      properties: {
        useCaseFile: { type: 'string' },
        personaFile: { type: 'string' },
        linkSagaDefinitions: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'bizing.sagas.library.overview',
    description: 'Get aggregate loop counts (UCs/personas/sagas/runs/coverage).',
    method: 'GET',
    path: '/api/v1/sagas/library/overview',
    tags: ['sagas', 'library'],
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'bizing.sagas.useCases.list',
    description: 'List normalized UC entities used by saga loop.',
    method: 'GET',
    path: '/api/v1/sagas/use-cases',
    tags: ['sagas', 'library', 'use-cases'],
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        limit: { type: 'number', default: 500 },
      },
    },
  },
  {
    name: 'bizing.sagas.useCases.create',
    description: 'Create one top-level use-case definition.',
    method: 'POST',
    path: '/api/v1/sagas/use-cases',
    tags: ['sagas', 'library', 'use-cases'],
    parameters: {
      type: 'object',
      properties: {
        ucKey: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string' },
        summary: { type: 'string' },
        sourceFilePath: { type: 'string' },
        sourceRef: { type: 'string' },
      },
      required: ['ucKey', 'title'],
    },
  },
  {
    name: 'bizing.sagas.useCases.get',
    description: 'Get one use-case with full version history.',
    method: 'GET',
    path: '/api/v1/sagas/use-cases/{ucKey}',
    tags: ['sagas', 'library', 'use-cases'],
    parameters: {
      type: 'object',
      properties: {
        ucKey: { type: 'string' },
      },
      required: ['ucKey'],
    },
  },
  {
    name: 'bizing.sagas.useCases.update',
    description: 'Update top-level use-case metadata.',
    method: 'PATCH',
    path: '/api/v1/sagas/use-cases/{ucKey}',
    tags: ['sagas', 'library', 'use-cases'],
    parameters: {
      type: 'object',
      properties: {
        ucKey: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string' },
        summary: { type: 'string' },
        sourceFilePath: { type: 'string' },
        sourceRef: { type: 'string' },
      },
      required: ['ucKey'],
    },
  },
  {
    name: 'bizing.sagas.useCases.versions.create',
    description: 'Create one immutable use-case version snapshot.',
    method: 'POST',
    path: '/api/v1/sagas/use-cases/{ucKey}/versions',
    tags: ['sagas', 'library', 'use-cases'],
    parameters: {
      type: 'object',
      properties: {
        ucKey: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        bodyMarkdown: { type: 'string' },
        extractedNeeds: { type: 'array', items: { type: 'string' } },
        extractedScenario: { type: 'string' },
        isCurrent: { type: 'boolean' },
      },
      required: ['ucKey', 'bodyMarkdown'],
    },
  },
  {
    name: 'bizing.sagas.useCases.delete',
    description: 'Delete one use-case definition and its versions.',
    method: 'DELETE',
    path: '/api/v1/sagas/use-cases/{ucKey}',
    tags: ['sagas', 'library', 'use-cases'],
    parameters: {
      type: 'object',
      properties: {
        ucKey: { type: 'string' },
      },
      required: ['ucKey'],
    },
  },
  {
    name: 'bizing.sagas.personas.list',
    description: 'List normalized persona entities used by saga loop.',
    method: 'GET',
    path: '/api/v1/sagas/personas',
    tags: ['sagas', 'library', 'personas'],
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        limit: { type: 'number', default: 500 },
      },
    },
  },
  {
    name: 'bizing.sagas.personas.create',
    description: 'Create one top-level persona definition.',
    method: 'POST',
    path: '/api/v1/sagas/personas',
    tags: ['sagas', 'library', 'personas'],
    parameters: {
      type: 'object',
      properties: {
        personaKey: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string' },
        profileSummary: { type: 'string' },
        sourceFilePath: { type: 'string' },
        sourceRef: { type: 'string' },
      },
      required: ['personaKey', 'name'],
    },
  },
  {
    name: 'bizing.sagas.personas.get',
    description: 'Get one persona with full version history.',
    method: 'GET',
    path: '/api/v1/sagas/personas/{personaKey}',
    tags: ['sagas', 'library', 'personas'],
    parameters: {
      type: 'object',
      properties: {
        personaKey: { type: 'string' },
      },
      required: ['personaKey'],
    },
  },
  {
    name: 'bizing.sagas.personas.update',
    description: 'Update top-level persona metadata.',
    method: 'PATCH',
    path: '/api/v1/sagas/personas/{personaKey}',
    tags: ['sagas', 'library', 'personas'],
    parameters: {
      type: 'object',
      properties: {
        personaKey: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string' },
        profileSummary: { type: 'string' },
        sourceFilePath: { type: 'string' },
        sourceRef: { type: 'string' },
      },
      required: ['personaKey'],
    },
  },
  {
    name: 'bizing.sagas.personas.versions.create',
    description: 'Create one immutable persona version snapshot.',
    method: 'POST',
    path: '/api/v1/sagas/personas/{personaKey}/versions',
    tags: ['sagas', 'library', 'personas'],
    parameters: {
      type: 'object',
      properties: {
        personaKey: { type: 'string' },
        name: { type: 'string' },
        profile: { type: 'string' },
        goals: { type: 'string' },
        painPoints: { type: 'string' },
        testScenarios: { type: 'array', items: { type: 'string' } },
        bodyMarkdown: { type: 'string' },
        isCurrent: { type: 'boolean' },
      },
      required: ['personaKey', 'bodyMarkdown'],
    },
  },
  {
    name: 'bizing.sagas.personas.delete',
    description: 'Delete one persona definition and its versions.',
    method: 'DELETE',
    path: '/api/v1/sagas/personas/{personaKey}',
    tags: ['sagas', 'library', 'personas'],
    parameters: {
      type: 'object',
      properties: {
        personaKey: { type: 'string' },
      },
      required: ['personaKey'],
    },
  },
  {
    name: 'bizing.sagas.library.related',
    description:
      'Get one UC/persona node and all linked saga definitions (design-to-execution mapping).',
    method: 'GET',
    path: '/api/v1/sagas/library/related',
    tags: ['sagas', 'library', 'relations'],
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['use_case', 'persona'] },
        key: { type: 'string' },
      },
      required: ['kind', 'key'],
    },
  },
  {
    name: 'bizing.sagas.definitions.links.get',
    description: 'Get linked UC/persona versions for one saga definition.',
    method: 'GET',
    path: '/api/v1/sagas/definitions/{sagaKey}/links',
    tags: ['sagas', 'links'],
    parameters: {
      type: 'object',
      properties: {
        sagaKey: { type: 'string' },
      },
      required: ['sagaKey'],
    },
  },
  {
    name: 'bizing.sagas.runAssessments.reports.list',
    description: 'List run-assessment coverage reports generated from saga executions.',
    method: 'GET',
    path: '/api/v1/sagas/run-assessments/reports',
    tags: ['sagas', 'run-assessment'],
    parameters: {
      type: 'object',
      properties: {
        sagaRunId: { type: 'string' },
        sagaDefinitionId: { type: 'string' },
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'bizing.sagas.runAssessments.reports.get',
    description: 'Get one run-assessment coverage report with normalized coverage items and tags.',
    method: 'GET',
    path: '/api/v1/sagas/run-assessments/reports/{reportId}',
    tags: ['sagas', 'run-assessment'],
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
      },
      required: ['reportId'],
    },
  },
  {
    name: 'bizing.sagas.schemaCoverage.reports.list',
    description:
      'List schema-baseline coverage reports imported from markdown (not from run execution).',
    method: 'GET',
    path: '/api/v1/sagas/schema-coverage/reports',
    tags: ['sagas', 'schema-coverage'],
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'bizing.sagas.schemaCoverage.reports.get',
    description: 'Get one schema-baseline coverage report with normalized UC coverage items and tags.',
    method: 'GET',
    path: '/api/v1/sagas/schema-coverage/reports/{reportId}',
    tags: ['sagas', 'schema-coverage'],
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
      },
      required: ['reportId'],
    },
  },
  {
    name: 'bizing.sagas.coverage.reports.list',
    description:
      'Legacy alias for run-assessment coverage list. Prefer bizing.sagas.runAssessments.reports.list.',
    method: 'GET',
    path: '/api/v1/sagas/coverage/reports',
    tags: ['sagas', 'coverage', 'legacy'],
    parameters: {
      type: 'object',
      properties: {
        sagaRunId: { type: 'string' },
        sagaDefinitionId: { type: 'string' },
        scopeType: { type: 'string' },
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'bizing.sagas.coverage.reports.get',
    description:
      'Legacy alias for coverage detail. Prefer runAssessments/schemaCoverage endpoints.',
    method: 'GET',
    path: '/api/v1/sagas/coverage/reports/{reportId}',
    tags: ['sagas', 'coverage', 'legacy'],
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
      },
      required: ['reportId'],
    },
  },
  {
    name: 'bizing.sagas.schemaCoverage.import',
    description:
      'Import schema coverage markdown into normalized report/items/tags for dashboard filtering.',
    method: 'POST',
    path: '/api/v1/sagas/schema-coverage/import',
    tags: ['sagas', 'schema-coverage', 'admin'],
    parameters: {
      type: 'object',
      properties: {
        coverageFile: { type: 'string' },
        replaceExisting: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'bizing.sagas.library.resetReseed',
    description:
      'Dangerous admin operation: wipe loop data (UC/persona/sagas/runs/coverage/tags) and reseed from canonical docs.',
    method: 'POST',
    path: '/api/v1/sagas/library/reset-reseed',
    tags: ['sagas', 'library', 'admin'],
    parameters: {
      type: 'object',
      properties: {
        useCaseFile: { type: 'string' },
        personaFile: { type: 'string' },
        coverageFile: { type: 'string' },
        linkSagaDefinitions: { type: 'boolean', default: true },
        regenerateSpecs: { type: 'boolean', default: true },
        syncDefinitions: { type: 'boolean', default: true },
        importSchemaCoverage: { type: 'boolean', default: true },
        replaceExistingSchemaCoverage: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'bizing.sagas.runs.create',
    description: 'Create one saga run from a saga definition key.',
    method: 'POST',
    path: '/api/v1/sagas/runs',
    tags: ['sagas', 'runs'],
    parameters: {
      type: 'object',
      properties: {
        sagaKey: { type: 'string' },
        bizId: { type: 'string' },
        mode: { type: 'string', enum: ['dry_run', 'live'] },
        runnerLabel: { type: 'string' },
        runContext: { type: 'object' },
      },
      required: ['sagaKey'],
    },
  },
  {
    name: 'bizing.sagas.runs.list',
    description: 'List saga runs for the current user context.',
    method: 'GET',
    path: '/api/v1/sagas/runs',
    tags: ['sagas', 'runs'],
    parameters: {
      type: 'object',
      properties: {
        sagaKey: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'number', default: 50 },
        includeArchived: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'bizing.sagas.runs.archive',
    description: 'Soft-archive one saga run so it is hidden from default run lists.',
    method: 'POST',
    path: '/api/v1/sagas/runs/{runId}/archive',
    tags: ['sagas', 'runs', 'archive'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'bizing.sagas.runs.archiveBulk',
    description: 'Soft-archive multiple saga runs in one request.',
    method: 'POST',
    path: '/api/v1/sagas/runs/archive',
    tags: ['sagas', 'runs', 'archive'],
    parameters: {
      type: 'object',
      properties: {
        runIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['runIds'],
    },
  },
  {
    name: 'bizing.sagas.runs.get',
    description: 'Get full saga run detail including steps and artifacts.',
    method: 'GET',
    path: '/api/v1/sagas/runs/{runId}',
    tags: ['sagas', 'runs'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'bizing.sagas.runs.execute',
    description:
      'Execute one pending/running saga run server-side using deterministic runner logic.',
    method: 'POST',
    path: '/api/v1/sagas/runs/{runId}/execute',
    tags: ['sagas', 'runs', 'executor'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'bizing.sagas.runs.coverage',
    description:
      'Get server coverage verdict (full/partial/gap), failing step reasons, and missing evidence for one run.',
    method: 'GET',
    path: '/api/v1/sagas/runs/{runId}/coverage',
    tags: ['sagas', 'runs', 'coverage'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'bizing.sagas.runs.actors.list',
    description: 'List run actor virtual identities (email/phone) for one saga run.',
    method: 'GET',
    path: '/api/v1/sagas/runs/{runId}/actors',
    tags: ['sagas', 'runs', 'actors'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'bizing.sagas.runs.messages.list',
    description: 'List simulated actor messages for one run.',
    method: 'GET',
    path: '/api/v1/sagas/runs/{runId}/messages',
    tags: ['sagas', 'runs', 'messages'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        actorKey: { type: 'string' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'bizing.sagas.runs.messages.create',
    description: 'Create one simulated actor message (email/sms/push/in-app) for a run.',
    method: 'POST',
    path: '/api/v1/sagas/runs/{runId}/messages',
    tags: ['sagas', 'runs', 'messages'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        stepKey: { type: 'string' },
        fromActorKey: { type: 'string' },
        toActorKey: { type: 'string' },
        channel: { type: 'string', enum: ['email', 'sms', 'push', 'in_app'] },
        subject: { type: 'string' },
        bodyText: { type: 'string' },
        status: { type: 'string', enum: ['queued', 'sent', 'delivered', 'read', 'failed', 'cancelled'] },
        metadata: { type: 'object' },
      },
      required: ['runId', 'toActorKey', 'channel', 'bodyText'],
    },
  },
  {
    name: 'bizing.sagas.steps.reportResult',
    description: 'Update one saga run step status/result payload.',
    method: 'POST',
    path: '/api/v1/sagas/runs/{runId}/steps/{stepKey}/result',
    tags: ['sagas', 'steps'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        stepKey: { type: 'string' },
        status: { type: 'string' },
        startedAt: { type: 'string' },
        endedAt: { type: 'string' },
        failureCode: { type: 'string' },
        failureMessage: { type: 'string' },
        resultPayload: { type: 'object' },
        assertionSummary: { type: 'object' },
      },
      required: ['runId', 'stepKey', 'status'],
    },
  },
  {
    name: 'bizing.sagas.artifacts.addSnapshot',
    description:
      'Attach one snapshot to saga run. Preferred: snapshot.v1 `view` blocks that represent what user saw.',
    method: 'POST',
    path: '/api/v1/sagas/runs/{runId}/snapshots',
    tags: ['sagas', 'artifacts', 'snapshots'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        stepKey: { type: 'string' },
        screenKey: { type: 'string' },
        title: { type: 'string' },
        format: { type: 'string', enum: ['json', 'yaml'] },
        status: { type: 'string' },
        actorKey: { type: 'string' },
        route: { type: 'string' },
        view: {
          type: 'object',
          properties: {
            route: { type: 'string' },
            title: { type: 'string' },
            subtitle: { type: 'string' },
            blocks: {
              type: 'array',
              description:
                'Array of typed low-fi UI blocks. Examples: alert, stats, key_value, table, list, form, calendar.',
              items: { type: 'object' },
            },
          },
        },
        data: { type: 'object' },
        rawData: {
          type: 'object',
          description:
            'Optional deep-inspection payload (request/response/trace) shown in Data tab.',
        },
      },
      required: ['runId'],
    },
  },
  {
    name: 'bizing.sagas.artifacts.addApiTrace',
    description: 'Attach one API trace artifact to a saga run (optionally step-scoped).',
    method: 'POST',
    path: '/api/v1/sagas/runs/{runId}/traces',
    tags: ['sagas', 'artifacts', 'traces'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        stepKey: { type: 'string' },
        title: { type: 'string' },
        trace: { type: 'object' },
        metadata: { type: 'object' },
      },
      required: ['runId', 'trace'],
    },
  },
  {
    name: 'bizing.sagas.artifacts.submitReport',
    description: 'Attach final markdown report to saga run.',
    method: 'POST',
    path: '/api/v1/sagas/runs/{runId}/report',
    tags: ['sagas', 'artifacts', 'reports'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        markdown: { type: 'string' },
        summary: { type: 'object' },
      },
      required: ['runId', 'markdown'],
    },
  },
  {
    name: 'bizing.sagas.testMode.next',
    description: 'Get next actionable saga step for agent test-mode sessions.',
    method: 'GET',
    path: '/api/v1/sagas/test-mode/next',
    tags: ['sagas', 'test-mode'],
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        sagaKey: { type: 'string' },
        bizId: { type: 'string' },
      },
    },
  },
]

export function findTool(name: string): ApiToolDefinition | undefined {
  return apiTools.find((tool) => tool.name === name)
}

export function searchTools(query: string): ApiToolDefinition[] {
  const q = query.trim().toLowerCase()
  if (!q) return apiTools

  return apiTools
    .map((tool) => {
      const haystack = `${tool.name} ${tool.description} ${tool.path} ${tool.tags.join(' ')}`.toLowerCase()
      const score = haystack.includes(q) ? 1 : 0
      return { tool, score }
    })
    .filter((entry) => entry.score > 0)
    .map((entry) => entry.tool)
}
