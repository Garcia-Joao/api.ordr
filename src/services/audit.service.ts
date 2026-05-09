import { prisma } from '../lib/prisma'

type AuditLogInput = {
  companyId: string
  userId?: string | null
  entityType: string
  entityId: string
  action: string
  description?: string | null
  oldValues?: unknown
  newValues?: unknown
  metadata?: unknown
}

export async function createAuditLog(tx: any, input: AuditLogInput) {
  await tx.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      description: input.description ?? null,
      oldValues: input.oldValues ?? undefined,
      newValues: input.newValues ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  })
}

export async function createAuditLogDirect(input: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      description: input.description ?? null,
      oldValues: input.oldValues ?? undefined,
      newValues: input.newValues ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  })
}

type ListAuditLogsInput = {
  companyId: string
  action?: string
  entityType?: string
  userId?: string
  search?: string
  from?: string
  to?: string
  take?: number
  cursor?: string
}

export async function listAuditLogs(input: ListAuditLogsInput) {
  const take = Math.min(Math.max(input.take ?? 50, 1), 100)

  const where: any = {
    companyId: input.companyId,
  }

  if (input.action) where.action = input.action
  if (input.entityType) where.entityType = input.entityType
  if (input.userId) where.userId = input.userId

  if (input.from || input.to) {
    where.createdAt = {}
    if (input.from) where.createdAt.gte = new Date(input.from)
    if (input.to) where.createdAt.lte = new Date(input.to)
  }

  if (input.search?.trim()) {
    const search = input.search.trim()

    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { entityType: { contains: search, mode: 'insensitive' } },
      { entityId: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { user: { is: { username: { contains: search, mode: 'insensitive' } } } },
      { user: { is: { name: { contains: search, mode: 'insensitive' } } } },
    ]
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          photoBase64: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(input.cursor
      ? {
          cursor: { id: input.cursor },
          skip: 1,
        }
      : {}),
  })

  const hasMore = logs.length > take
  const items = hasMore ? logs.slice(0, take) : logs

  return {
    logs: items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  }
}
