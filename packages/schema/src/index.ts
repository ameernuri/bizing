import { z } from 'zod'

// Common schemas
export const idSchema = z.string().uuid()

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
})

export const timestampsSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  deletedAt: z.string().datetime().nullable().optional()
})

// Organization
export const organizationSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  logoUrl: z.string().url().nullable().optional(),
  timezone: z.string().default('UTC'),
  currency: z.string().length(3).default('USD'),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  settings: z.record(z.unknown()).default({}),
  ...timestampsSchema.shape
})

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  subdomain: z.string().min(3).max(50).optional()
})

// User
export const userSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  email: z.string().email(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  role: z.enum(['owner', 'admin', 'manager', 'staff']).default('staff'),
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
  avatarUrl: z.string().url().nullable().optional(),
  ...timestampsSchema.shape
})

// Service
export const serviceSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  categoryId: idSchema.nullable().optional(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().default(60),
  bufferBeforeMinutes: z.number().int().default(0),
  bufferAfterMinutes: z.number().int().default(0),
  price: z.number().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  isActive: z.boolean().default(true),
  isOnlineBookable: z.boolean().default(true),
  imageUrl: z.string().url().nullable().optional(),
  ...timestampsSchema.shape
})

// Booking
export const bookingSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  serviceId: idSchema,
  customerId: idSchema.nullable().optional(),
  customerName: z.string().max(255).nullable().optional(),
  customerEmail: z.string().email().nullable().optional(),
  customerPhone: z.string().max(50).nullable().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).default('pending'),
  notes: z.string().nullable().optional(),
  price: z.number().min(0).default(0),
  source: z.string().max(50).default('website'),
  confirmationCode: z.string().max(20).nullable().optional(),
  ...timestampsSchema.shape
})

// Product
export const productSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  price: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  type: z.enum(['digital', 'service', 'subscription']).default('digital'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  imageUrl: z.string().url().nullable().optional(),
  downloadUrl: z.string().url().nullable().optional(),
  ...timestampsSchema.shape
})

// API Response schemas
export const apiResponseSchema = <T>(dataSchema: z.ZodType<T>) => 
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string()
    }).optional()
  })

export const listResponseSchema = <T>(itemSchema: z.ZodType<T>) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number()
    })
  })
