import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_CATALOG,
  isKnownPermission,
} from '../auth/permissions'

function uniqueKnownPermissions(permissionKeys: string[]) {
  return Array.from(
    new Set(
      permissionKeys
        .map((permission) => permission.trim())
        .filter(Boolean)
        .filter(isKnownPermission)
    )
  )
}

export function getPermissionCatalog() {
  return PERMISSION_CATALOG
}

export async function userHasPermission(input: {
  userId: string
  companyId: string
  permission: string
}) {
  const membership = await prisma.userCompany.findUnique({
    where: {
      userId_companyId: {
        userId: input.userId,
        companyId: input.companyId,
      },
    },
    include: {
      customRole: {
        include: {
          permissions: true,
        },
      },
    },
  })

  if (!membership) return false
  if (membership.systemRole === 'ADMIN') return true

  return (
    membership.customRole?.active === true &&
    membership.customRole.permissions.some(
      (permission) => permission.permissionKey === input.permission
    )
  )
}

export async function getPermissionsForMembership(input: {
  userId: string
  companyId: string
}) {
  const membership = await prisma.userCompany.findUnique({
    where: {
      userId_companyId: {
        userId: input.userId,
        companyId: input.companyId,
      },
    },
    include: {
      customRole: {
        include: {
          permissions: true,
        },
      },
    },
  })

  if (!membership) return []
  if (membership.systemRole === 'ADMIN') return ALL_PERMISSION_KEYS
  if (!membership.customRole?.active) return []

  return membership.customRole.permissions.map(
    (permission) => permission.permissionKey
  )
}

export async function listRoles(companyId: string) {
  return prisma.role.findMany({
    where: { companyId },
    include: {
      permissions: {
        orderBy: { permissionKey: 'asc' },
      },
      _count: {
        select: { memberships: true },
      },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })
}

export async function createRole(input: {
  companyId: string
  userId?: string | null
  name: string
  description?: string | null
  permissionKeys: string[]
}) {
  const name = input.name.trim()
  if (!name) throw new Error('ROLE_NAME_REQUIRED')

  const permissionKeys = uniqueKnownPermissions(input.permissionKeys)

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        companyId: input.companyId,
        name,
        description: input.description?.trim() || null,
        permissions: {
          create: permissionKeys.map((permissionKey) => ({ permissionKey })),
        },
      },
      include: { permissions: true, _count: { select: { memberships: true } } },
    })

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        entityType: 'Role',
        entityId: created.id,
        action: 'ROLE_CREATED',
        description: `Cargo criado: ${created.name}`,
        newValues: {
          name: created.name,
          description: created.description,
          permissions: permissionKeys,
        },
      },
    })

    return created
  })

  return role
}

export async function updateRole(input: {
  companyId: string
  userId?: string | null
  roleId: string
  name?: string
  description?: string | null
  active?: boolean
  permissionKeys?: string[]
}) {
  const existing = await prisma.role.findFirst({
    where: { id: input.roleId, companyId: input.companyId },
    include: { permissions: true },
  })

  if (!existing) throw new Error('ROLE_NOT_FOUND')

  const nextPermissionKeys =
    typeof input.permissionKeys === 'undefined'
      ? existing.permissions.map((permission) => permission.permissionKey)
      : uniqueKnownPermissions(input.permissionKeys)

  const data: Prisma.RoleUpdateInput = {
    name:
      typeof input.name === 'string' && input.name.trim()
        ? input.name.trim()
        : undefined,
    description:
      typeof input.description === 'undefined'
        ? undefined
        : input.description?.trim() || null,
    active: typeof input.active === 'boolean' ? input.active : undefined,
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: input.roleId } })

    const role = await tx.role.update({
      where: { id: input.roleId },
      data: {
        ...data,
        permissions: {
          create: nextPermissionKeys.map((permissionKey) => ({ permissionKey })),
        },
      },
      include: { permissions: true, _count: { select: { memberships: true } } },
    })

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        entityType: 'Role',
        entityId: role.id,
        action: 'ROLE_UPDATED',
        description: `Cargo atualizado: ${role.name}`,
        oldValues: {
          name: existing.name,
          description: existing.description,
          active: existing.active,
          permissions: existing.permissions.map((permission) => permission.permissionKey),
        },
        newValues: {
          name: role.name,
          description: role.description,
          active: role.active,
          permissions: nextPermissionKeys,
        },
      },
    })

    return role
  })

  return updated
}

export async function deleteRole(input: {
  companyId: string
  userId?: string | null
  roleId: string
}) {
  const existing = await prisma.role.findFirst({
    where: { id: input.roleId, companyId: input.companyId },
    include: { permissions: true },
  })

  if (!existing) throw new Error('ROLE_NOT_FOUND')

  await prisma.$transaction(async (tx) => {
    await tx.userCompany.updateMany({
      where: { companyId: input.companyId, customRoleId: input.roleId },
      data: { customRoleId: null },
    })

    await tx.role.delete({ where: { id: input.roleId } })

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        entityType: 'Role',
        entityId: existing.id,
        action: 'ROLE_DELETED',
        description: `Cargo excluído: ${existing.name}`,
        oldValues: {
          name: existing.name,
          description: existing.description,
          active: existing.active,
          permissions: existing.permissions.map((permission) => permission.permissionKey),
        },
      },
    })
  })

  return { ok: true }
}

async function getMembershipForResponse(
  tx: Prisma.TransactionClient | typeof prisma,
  membershipId: string
) {
  return tx.userCompany.findUnique({
    where: { id: membershipId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          photoBase64: true,
          createdAt: true,
        },
      },
      customRole: {
        include: { permissions: true, _count: { select: { memberships: true } } },
      },
      activeEventDate: { include: { salesEnvironment: true } },
    },
  })
}

export async function listCompanyUsers(companyId: string) {
  return prisma.userCompany.findMany({
    where: { companyId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          photoBase64: true,
          createdAt: true,
        },
      },
      customRole: {
        include: { permissions: true, _count: { select: { memberships: true } } },
      },
      activeEventDate: { include: { salesEnvironment: true } },
    },
    orderBy: [{ systemRole: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function createCompanyUser(input: {
  companyId: string
  actorUserId?: string | null
  username: string
  password: string
  name?: string | null
  phone?: string | null
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  activeEventDateId?: string | null
}) {
  const username = input.username.trim()
  const password = input.password.trim()
  const name = input.name?.trim() || null
  const phone = input.phone?.trim() || null

  if (!username) throw new Error('USERNAME_REQUIRED')
  if (username.length < 3) throw new Error('USERNAME_TOO_SHORT')
  if (!password) throw new Error('PASSWORD_REQUIRED')
  if (password.length < 6) throw new Error('PASSWORD_TOO_SHORT')

  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  })

  if (existingUser) throw new Error('USERNAME_ALREADY_EXISTS')

  let customRoleId: string | null = null

  if (input.systemRole === 'CUSTOM') {
    if (!input.customRoleId) throw new Error('CUSTOM_ROLE_REQUIRED')

    const role = await prisma.role.findFirst({
      where: { id: input.customRoleId, companyId: input.companyId, active: true },
    })

    if (!role) throw new Error('ROLE_NOT_FOUND')
    customRoleId = role.id
  }

  const activeEventDateId = await resolveActiveEventDateId({
    companyId: input.companyId,
    activeEventDateId: input.activeEventDateId ?? null,
  })

  const hashedPassword = await bcrypt.hash(password, 10)

  const membership = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        phone,
        role: 'admin',
        memberships: {
          create: {
            companyId: input.companyId,
            role: 'admin',
            systemRole: input.systemRole,
            customRoleId,
            activeEventDateId,
          },
        },
      },
      include: { memberships: true },
    })

    const createdMembership = user.memberships.find(
      (membership) => membership.companyId === input.companyId
    )

    if (!createdMembership) throw new Error('MEMBERSHIP_NOT_CREATED')

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId ?? null,
        entityType: 'User',
        entityId: user.id,
        action: 'USER_CREATED',
        description: `Usuário criado: ${name || username}`,
        newValues: {
          username,
          name,
          phone,
          systemRole: input.systemRole,
          customRoleId,
          activeEventDateId,
        },
      },
    })

    return getMembershipForResponse(tx, createdMembership.id)
  })

  if (!membership) throw new Error('MEMBERSHIP_NOT_CREATED')
  return membership
}


async function resolveActiveEventDateId(input: {
  companyId: string
  activeEventDateId?: string | null
}) {
  if (!input.activeEventDateId) return null

  const eventDate = await prisma.eventDate.findFirst({
    where: { id: input.activeEventDateId, companyId: input.companyId },
    select: { id: true },
  })

  if (!eventDate) throw new Error('EVENT_DATE_NOT_FOUND')
  return eventDate.id
}

export async function listAssignableEventDates(companyId: string) {
  const now = new Date()
  const from = new Date(now)
  from.setMonth(from.getMonth() - 2)

  const to = new Date(now)
  to.setMonth(to.getMonth() + 6)

  return prisma.eventDate.findMany({
    where: {
      companyId,
      startAt: { gte: from, lte: to },
      status: { not: 'cancelled' },
    },
    include: { salesEnvironment: true },
    orderBy: [{ startAt: 'asc' }, { title: 'asc' }],
  })
}

export async function updateMyActiveEventDate(input: {
  companyId: string
  userId: string
  activeEventDateId?: string | null
}) {
  const activeEventDateId = await resolveActiveEventDateId({
    companyId: input.companyId,
    activeEventDateId: input.activeEventDateId ?? null,
  })

  const membership = await prisma.userCompany.update({
    where: {
      userId_companyId: {
        userId: input.userId,
        companyId: input.companyId,
      },
    },
    data: { activeEventDateId },
    include: { activeEventDate: { include: { salesEnvironment: true } } },
  })

  return {
    activeEventDateId: membership.activeEventDateId,
    activeEventDate: membership.activeEventDate,
  }
}

async function ensureAnotherAdminWillRemain(input: {
  companyId: string
  membershipId: string
}) {
  const membership = await prisma.userCompany.findFirst({
    where: { id: input.membershipId, companyId: input.companyId },
  })

  if (!membership) throw new Error('MEMBERSHIP_NOT_FOUND')
  if (membership.systemRole !== 'ADMIN') return

  const adminCount = await prisma.userCompany.count({
    where: {
      companyId: input.companyId,
      systemRole: 'ADMIN',
      id: { not: input.membershipId },
    },
  })

  if (adminCount <= 0) throw new Error('LAST_ADMIN_CANNOT_BE_CHANGED')
}

function resolveCustomRoleId(input: {
  companyId: string
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  activeEventDateId?: string | null
}) {
  if (input.systemRole === 'ADMIN') return Promise.resolve<string | null>(null)
  if (!input.customRoleId) throw new Error('CUSTOM_ROLE_REQUIRED')

  return prisma.role
    .findFirst({
      where: { id: input.customRoleId, companyId: input.companyId, active: true },
    })
    .then((role) => {
      if (!role) throw new Error('ROLE_NOT_FOUND')
      return role.id
    })
}

export async function updateMembershipAccess(input: {
  companyId: string
  userId?: string | null
  membershipId: string
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  activeEventDateId?: string | null
}) {
  const existing = await prisma.userCompany.findFirst({
    where: { id: input.membershipId, companyId: input.companyId },
    include: { user: { select: { username: true, name: true } }, customRole: true, activeEventDate: true },
  })

  if (!existing) throw new Error('MEMBERSHIP_NOT_FOUND')
  if (input.systemRole !== 'ADMIN') {
    await ensureAnotherAdminWillRemain({ companyId: input.companyId, membershipId: input.membershipId })
  }

  const customRoleId = await resolveCustomRoleId({
    companyId: input.companyId,
    systemRole: input.systemRole,
    customRoleId: input.customRoleId,
  })

  const activeEventDateId = await resolveActiveEventDateId({
    companyId: input.companyId,
    activeEventDateId: input.activeEventDateId ?? existing.activeEventDateId ?? null,
  })

  const updated = await prisma.$transaction(async (tx) => {
    const membership = await tx.userCompany.update({
      where: { id: input.membershipId },
      data: { systemRole: input.systemRole, customRoleId, activeEventDateId },
      include: { user: { select: { username: true, name: true } }, customRole: true, activeEventDate: true },
    })

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        entityType: 'UserCompany',
        entityId: membership.id,
        action: input.systemRole === 'ADMIN' ? 'USER_ADMIN_GRANTED' : 'USER_ROLE_ASSIGNED',
        description: `Acesso atualizado para ${membership.user.name || membership.user.username}`,
        oldValues: {
          systemRole: existing.systemRole,
          customRoleId: existing.customRoleId,
          customRoleName: existing.customRole?.name ?? null,
          activeEventDateId: existing.activeEventDateId ?? null,
          activeEventTitle: existing.activeEventDate?.title ?? null,
        },
        newValues: {
          systemRole: membership.systemRole,
          customRoleId: membership.customRoleId,
          customRoleName: membership.customRole?.name ?? null,
          activeEventDateId: membership.activeEventDateId ?? null,
          activeEventTitle: membership.activeEventDate?.title ?? null,
        },
      },
    })

    return getMembershipForResponse(tx, membership.id)
  })

  if (!updated) throw new Error('MEMBERSHIP_NOT_FOUND')
  return updated
}

export async function updateCompanyUser(input: {
  companyId: string
  actorUserId?: string | null
  membershipId: string
  username?: string
  password?: string | null
  name?: string | null
  phone?: string | null
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  activeEventDateId?: string | null
}) {
  const existing = await prisma.userCompany.findFirst({
    where: { id: input.membershipId, companyId: input.companyId },
    include: {
      user: { select: { id: true, username: true, name: true, phone: true } },
      customRole: true,
      activeEventDate: true,
    },
  })

  if (!existing) throw new Error('MEMBERSHIP_NOT_FOUND')
  if (input.systemRole !== 'ADMIN') {
    await ensureAnotherAdminWillRemain({ companyId: input.companyId, membershipId: input.membershipId })
  }

  const username = input.username?.trim()
  const password = input.password?.trim() || ''
  const name = typeof input.name === 'undefined' ? undefined : input.name?.trim() || null
  const phone = typeof input.phone === 'undefined' ? undefined : input.phone?.trim() || null

  if (username !== undefined) {
    if (!username) throw new Error('USERNAME_REQUIRED')
    if (username.length < 3) throw new Error('USERNAME_TOO_SHORT')

    if (username !== existing.user.username) {
      const duplicated = await prisma.user.findUnique({ where: { username }, select: { id: true } })
      if (duplicated) throw new Error('USERNAME_ALREADY_EXISTS')
    }
  }

  if (password && password.length < 6) throw new Error('PASSWORD_TOO_SHORT')

  const customRoleId = await resolveCustomRoleId({
    companyId: input.companyId,
    systemRole: input.systemRole,
    customRoleId: input.customRoleId,
  })

  const activeEventDateId = await resolveActiveEventDateId({
    companyId: input.companyId,
    activeEventDateId: input.activeEventDateId ?? existing.activeEventDateId ?? null,
  })

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.user.id },
      data: {
        username,
        name,
        phone,
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      },
    })

    const membership = await tx.userCompany.update({
      where: { id: input.membershipId },
      data: { systemRole: input.systemRole, customRoleId, activeEventDateId },
      include: {
        user: { select: { id: true, username: true, name: true, phone: true, photoBase64: true, createdAt: true } },
        customRole: { include: { permissions: true, _count: { select: { memberships: true } } } },
        activeEventDate: { include: { salesEnvironment: true } },
      },
    })

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId ?? null,
        entityType: 'User',
        entityId: existing.user.id,
        action: 'USER_UPDATED',
        description: `Usuário atualizado: ${membership.user.name || membership.user.username}`,
        oldValues: {
          username: existing.user.username,
          name: existing.user.name,
          phone: existing.user.phone,
          systemRole: existing.systemRole,
          customRoleId: existing.customRoleId,
          customRoleName: existing.customRole?.name ?? null,
          activeEventDateId: existing.activeEventDateId ?? null,
          activeEventTitle: existing.activeEventDate?.title ?? null,
        },
        newValues: {
          username: membership.user.username,
          name: membership.user.name,
          phone: membership.user.phone,
          systemRole: membership.systemRole,
          customRoleId: membership.customRoleId,
          customRoleName: membership.customRole?.name ?? null,
          activeEventDateId: membership.activeEventDateId ?? null,
          activeEventTitle: membership.activeEventDate?.title ?? null,
          passwordChanged: Boolean(password),
        },
      },
    })

    return membership
  })

  return updated
}
