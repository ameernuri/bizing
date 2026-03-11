import { z } from 'zod'

export const memberOffboardChecklistItemSchema = z.object({
  key: z.string().min(1).max(120),
  label: z.string().min(1).max(220).optional(),
  completed: z.boolean(),
})

export const bulkDeleteMembersBodySchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1),
  confirmationText: z.string().min(1).max(120),
  reason: z.string().min(1).max(500),
})

export const offboardMemberBodySchema = z.object({
  reason: z.string().min(1).max(500),
  checklist: z.array(memberOffboardChecklistItemSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
})

export function expectedBulkDeleteConfirmation(memberCount: number) {
  return `DELETE ${memberCount} MEMBERS`
}

