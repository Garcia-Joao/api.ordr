import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { ALL_PERMISSION_KEYS } from '../auth/permissions'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

type LicenseInfo = {
  licenseActive: boolean
  licenseStatus: string
  licensePlanName: string | null
  licenseStartsAt: string | null
  licenseEndsAt: string | null
  licenseDaysRemaining: number | null
  platformAccessStatus: string
  platformBlockedReason: string | null
  licenseSourceCompanyId: string | null
  licenseSourceCompanyName: string | null
}

type SafeCompany = LicenseInfo & {
  id: string
  name: string
  isTest: boolean
  testSourceCompanyId: string | null
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
  currentCompany: SafeCompany | null
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
    company: any
  }>
}

function getDaysRemaining(endsAt: Date | string | null | undefined) {
  if (!endsAt) return null

  const end = new Date(endsAt).getTime()
  if (Number.isNaN(end)) return null

  const diff = end - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function resolveCompanyLicenseInfo(company: any): LicenseInfo {
  const sourceCompany = company?.isTest && company?.testSourceCompany
    ? company.testSourceCompany
    : company
  const now = new Date()
  const licenses = Array.isArray(sourceCompany?.platformLicenses)
    ? sourceCompany.platformLicenses
    : []

  const activeLicense = licenses.find((license: any) => {
    const startsAt = license.startsAt ? new Date(license.startsAt) : null
    const endsAt = license.endsAt ? new Date(license.endsAt) : null

    return (
      String(license.status) === 'ACTIVE' &&
      (!startsAt || startsAt <= now) &&
      (!endsAt || endsAt > now)
    )
  })

  const displayLicense = activeLicense ?? licenses[0] ?? null
  const platformAccessStatus = String(sourceCompany?.platformAccessStatus ?? 'ACTIVE')
  const licenseActive = platformAccessStatus === 'ACTIVE' && Boolean(activeLicense)

  return {
    licenseActive,
    licenseStatus: licenseActive
      ? 'ACTIVE'
      : platformAccessStatus !== 'ACTIVE'
        ? platformAccessStatus
        : displayLicense?.status
          ? String(displayLicense.status)
          : 'INACTIVE',
    licensePlanName: displayLicense?.plan?.name ?? null,
    licenseStartsAt: displayLicense?.startsAt
      ? new Date(displayLicense.startsAt).toISOString()
      : null,
    licenseEndsAt: displayLicense?.endsAt
      ? new Date(displayLicense.endsAt).toISOString()
      : null,
    licenseDaysRemaining: getDaysRemaining(displayLicense?.endsAt ?? null),
    platformAccessStatus,
    platformBlockedReason: sourceCompany?.platformBlockedReason ?? null,
    licenseSourceCompanyId: sourceCompany?.id ?? null,
    licenseSourceCompanyName: sourceCompany?.name ?? null,
  }
}

function membershipToSafeCompany(
  membership: UserWithMemberships['memberships'][number]
): SafeCompany {
  const systemRole = String(membership.systemRole ?? 'ADMIN') as 'ADMIN' | 'CUSTOM'

  return {
    id: membership.company.id,
    name: membership.company.name,
    isTest: membership.company.isTest,
    testSourceCompanyId: membership.company.testSourceCompanyId ?? null,
    role: String(membership.role),
    systemRole,
    customRoleId: membership.customRoleId ?? null,
    customRoleName: membership.customRole?.name ?? null,
    activeEventDateId: membership.activeEventDateId ?? null,
    permissions: membershipPermissions(membership),
    ...resolveCompanyLicenseInfo(membership.company),
  }
}

function canAccessMembershipCompany(membership: UserWithMemberships['memberships'][number]) {
  return resolveCompanyLicenseInfo(membership.company).licenseActive
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
  const sortedMemberships = [...user.memberships].sort((a, b) => {
    if (a.company.isTest !== b.company.isTest) return a.company.isTest ? 1 : -1
    return a.company.name.localeCompare(b.company.name)
  })

  const safeCompanies = sortedMemberships.map(membershipToSafeCompany)
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
  const currentCompany =
    safeCompanies.find((company) => company.id === activeCompanyId) ??
    safeCompanies[0] ??
    null

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
    companyId: currentCompany?.id ?? activeCompanyId,
    currentCompany,
    companies: safeCompanies,
  }
}


const userMembershipInclude = {
  company: {
    include: {
      platformLicenses: {
        include: { plan: true },
        orderBy: { startsAt: 'desc' as const },
      },
      testSourceCompany: {
        include: {
          platformLicenses: {
            include: { plan: true },
            orderBy: { startsAt: 'desc' as const },
          },
        },
      },
    },
  },
  customRole: { include: { permissions: true } },
}

export function createTerminalLaunchToken(input: {
  userId: string
  companyId: string
}) {
  return jwt.sign(
    {
      sub: input.userId,
      companyId: input.companyId,
      purpose: 'terminal-launch',
    },
    JWT_SECRET,
    { expiresIn: '2m' }
  )
}

export async function loginTerminalWithLaunchToken(launchToken: string) {
  try {
    const decoded = jwt.verify(launchToken, JWT_SECRET) as {
      sub: string
      companyId: string
      purpose?: string
    }

    if (decoded.purpose !== 'terminal-launch') {
      throw new Error('INVALID_TERMINAL_TOKEN')
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        memberships: {
          where: {
            companyId: decoded.companyId,
          },
          include: {
            company: true,
          },
        },
      },
    })

    if (!user) throw new Error('INVALID_TERMINAL_TOKEN')

    const membership = user.memberships[0]
    if (!membership) throw new Error('INVALID_TERMINAL_TOKEN')

    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: String(user.role),
        companyId: decoded.companyId,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        companyId: decoded.companyId,
        currentCompany: {
          id: membership.company.id,
          name: membership.company.name,
          isTest: membership.company.isTest,
          systemRole: membership.systemRole,
        },
        companies: user.memberships.map((item) => ({
          id: item.company.id,
          name: item.company.name,
          isTest: item.company.isTest,
          systemRole: item.systemRole,
        })),
      },
    }
  } catch {
    throw new Error('INVALID_TERMINAL_TOKEN')
  }
}

export async function loginUser(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      memberships: {
        include: userMembershipInclude,
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

  const activeCompanyId =
    user.memberships.find((membership) => !membership.company.isTest && canAccessMembershipCompany(membership))?.company.id ??
    user.memberships.find((membership) => canAccessMembershipCompany(membership))?.company.id ??
    user.memberships.find((membership) => !membership.company.isTest)?.company.id ??
    user.memberships[0].company.id
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
        include: userMembershipInclude,
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  const activeMembership = user.memberships.find(
    (membership) => membership.company.id === decoded.companyId
  )

  if (!activeMembership) {
    throw new Error('COMPANY_ACCESS_DENIED')
  }

  if (activeMembership.company.isTest && activeMembership.systemRole !== 'ADMIN') {
    throw new Error('ADMIN_ACCESS_REQUIRED')
  }

  return toSafeUser(user, decoded.companyId)
}

export async function switchUserCompany(userId: string, companyId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: userMembershipInclude,
      },
    },
  })

  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  const targetMembership = user.memberships.find(
    (membership) => membership.company.id === companyId
  )

  if (!targetMembership) {
    throw new Error('COMPANY_ACCESS_DENIED')
  }

  if (targetMembership.company.isTest && targetMembership.systemRole !== 'ADMIN') {
    throw new Error('ADMIN_ACCESS_REQUIRED')
  }

  if (!canAccessMembershipCompany(targetMembership)) {
    throw new Error('COMPANY_LICENSE_INACTIVE')
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
    include: userMembershipInclude,
    orderBy: { createdAt: 'asc' },
  })

  return memberships
    .sort((a, b) => {
      if (a.company.isTest !== b.company.isTest) return a.company.isTest ? 1 : -1
      return a.company.name.localeCompare(b.company.name)
    })
    .map((membership) => membershipToSafeCompany(membership as any))
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
        include: userMembershipInclude,
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
        include: userMembershipInclude,
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