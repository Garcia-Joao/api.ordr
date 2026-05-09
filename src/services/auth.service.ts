import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { ALL_PERMISSION_KEYS } from '../auth/permissions'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this'

type SafeCompany = {
  id: string
  name: string
  isTest: boolean
  role: string
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId: string | null
  customRoleName: string | null
  activeEventDateId: string | null
  permissions: string[]
}

export type SafeUser = {
  id: string
  username: string
  name: string | null
  phone: string | null
  photoBase64: string | null
  role: string
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId: string | null
  customRoleName: string | null
  activeEventDateId: string | null
  permissions: string[]
  companyId: string
  companies: SafeCompany[]
}

type UserWithMemberships = {
  id: string
  username: string
  name?: string | null
  phone?: string | null
  photoBase64?: string | null
  password: string
  role: any
  memberships: Array<{
    role: any
    systemRole?: any
    customRoleId?: string | null
    customRole?: {
      id: string
      name: string
      active: boolean
      permissions: Array<{ permissionKey: string }>
    } | null
    activeEventDateId?: string | null
    company: {
      id: string
      name: string
      isTest: boolean
    }
  }>
}

function membershipPermissions(
  membership: UserWithMemberships['memberships'][number]
) {
  const systemRole = String(membership.systemRole ?? 'ADMIN') as 'ADMIN' | 'CUSTOM'

  if (systemRole === 'ADMIN') return ALL_PERMISSION_KEYS

  if (!membership.customRole?.active) return []

  return membership.customRole.permissions.map(
    (permission) => permission.permissionKey
  )
}

function toSafeUser(user: UserWithMemberships, activeCompanyId: string): SafeUser {
  const activeMembership =
    user.memberships.find(
      (membership) => membership.company.id === activeCompanyId
    ) ?? user.memberships[0]

  const activeSystemRole = String(
    activeMembership?.systemRole ?? 'ADMIN'
  ) as 'ADMIN' | 'CUSTOM'
  const activePermissions = activeMembership
    ? membershipPermissions(activeMembership)
    : []

  return {
    id: user.id,
    username: user.username,
    name: user.name ?? null,
    phone: user.phone ?? null,
    photoBase64: user.photoBase64 ?? null,
    role: String(activeMembership?.role ?? user.role),
    systemRole: activeSystemRole,
    customRoleId: activeMembership?.customRoleId ?? null,
    customRoleName: activeMembership?.customRole?.name ?? null,
    activeEventDateId: activeMembership?.activeEventDateId ?? null,
    permissions: activePermissions,
    companyId: activeCompanyId,
    companies: user.memberships.map((membership) => ({
      id: membership.company.id,
      name: membership.company.name,
      isTest: membership.company.isTest,
      role: String(membership.role),
      systemRole: String(membership.systemRole ?? 'ADMIN') as 'ADMIN' | 'CUSTOM',
      customRoleId: membership.customRoleId ?? null,
      customRoleName: membership.customRole?.name ?? null,
      activeEventDateId: membership.activeEventDateId ?? null,
      permissions: membershipPermissions(membership),
    })),
  }
}


export async function loginUser(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      memberships: {
        include: { company: true, customRole: { include: { permissions: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!user) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const passwordMatches = await bcrypt.compare(password, user.password)

  if (!passwordMatches) {
    throw new Error('INVALID_CREDENTIALS')
  }

  if (user.memberships.length === 0) {
    throw new Error('USER_WITHOUT_COMPANY')
  }

  const activeCompanyId = user.memberships[0].company.id
  const safeUser = toSafeUser(user, activeCompanyId)

  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: String(user.role),
      companyId: activeCompanyId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  return {
    token,
    user: safeUser,
  }
}

export async function getUserFromToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET) as {
    sub: string
    username: string
    role: string
    companyId: string
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    include: {
      memberships: {
        include: { company: true, customRole: { include: { permissions: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  const hasAccessToCompany = user.memberships.some(
    (membership) => membership.company.id === decoded.companyId
  )

  if (!hasAccessToCompany) {
    throw new Error('COMPANY_ACCESS_DENIED')
  }

  return toSafeUser(user, decoded.companyId)
}

export async function switchUserCompany(userId: string, companyId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { company: true, customRole: { include: { permissions: true } } },
      },
    },
  })

  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  const hasAccessToCompany = user.memberships.some(
    (membership) => membership.company.id === companyId
  )

  if (!hasAccessToCompany) {
    throw new Error('COMPANY_ACCESS_DENIED')
  }

  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: String(user.role),
      companyId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  const safeUser = toSafeUser(user, companyId)

  return {
    token,
    user: safeUser,
  }
}

export async function getCompaniesForUser(userId: string) {
  const memberships = await prisma.userCompany.findMany({
    where: { userId },
    include: { company: true, customRole: { include: { permissions: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return memberships.map((membership) => ({
    id: membership.company.id,
    name: membership.company.name,
    isTest: membership.company.isTest,
    role: String(membership.role),
    systemRole: String(membership.systemRole ?? 'ADMIN') as 'ADMIN' | 'CUSTOM',
    customRoleId: membership.customRoleId ?? null,
    customRoleName: membership.customRole?.name ?? null,
    permissions: membershipPermissions(membership as any),
  }))
}

type UpdateMyAccountInput = {
  userId: string
  name?: string
  username?: string
  phone?: string
  photoBase64?: string | null
  currentPassword?: string
  newPassword?: string
}

export async function updateMyAccount(input: UpdateMyAccountInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      memberships: {
        include: { company: true, customRole: { include: { permissions: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  const isChangingUsername =
    typeof input.username !== 'undefined' &&
    input.username.trim() !== user.username

  const isChangingPassword = typeof input.newPassword !== 'undefined'

  if (isChangingUsername || isChangingPassword) {
    if (!input.currentPassword) {
      throw new Error('CURRENT_PASSWORD_REQUIRED')
    }

    const currentPasswordMatches = await bcrypt.compare(
      input.currentPassword,
      user.password
    )

    if (!currentPasswordMatches) {
      throw new Error('INVALID_CURRENT_PASSWORD')
    }
  }

  if (isChangingUsername) {
    const normalizedUsername = input.username!.trim()

    if (!normalizedUsername) {
      throw new Error('USERNAME_REQUIRED')
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })

    if (existingUser && existingUser.id !== user.id) {
      throw new Error('USERNAME_ALREADY_EXISTS')
    }
  }

  if (
    typeof input.photoBase64 !== 'undefined' &&
    input.photoBase64 &&
    input.photoBase64.length > 1_500_000
  ) {
    throw new Error('PHOTO_TOO_LARGE')
  }

  const data: {
    name?: string | null
    username?: string
    phone?: string | null
    photoBase64?: string | null
    password?: string
  } = {}

  if (typeof input.name !== 'undefined') {
    data.name = input.name.trim() || null
  }

  if (typeof input.username !== 'undefined') {
    const normalizedUsername = input.username.trim()

    if (!normalizedUsername) {
      throw new Error('USERNAME_REQUIRED')
    }

    data.username = normalizedUsername
  }

  if (typeof input.phone !== 'undefined') {
    data.phone = input.phone.trim() || null
  }

  if (typeof input.photoBase64 !== 'undefined') {
    data.photoBase64 = input.photoBase64 || null
  }

  if (typeof input.newPassword !== 'undefined') {
    const normalizedNewPassword = input.newPassword.trim()

    if (!normalizedNewPassword) {
      throw new Error('NEW_PASSWORD_REQUIRED')
    }

    if (normalizedNewPassword.length < 6) {
      throw new Error('PASSWORD_TOO_SHORT')
    }

    data.password = await bcrypt.hash(normalizedNewPassword, 10)
  }

  const updatedUser = await prisma.user.update({
    where: { id: input.userId },
    data,
    include: {
      memberships: {
        include: { company: true, customRole: { include: { permissions: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  const activeCompanyId = updatedUser.memberships[0]?.company.id

  if (!activeCompanyId) {
    throw new Error('USER_WITHOUT_COMPANY')
  }

  return toSafeUser(updatedUser, activeCompanyId)
}