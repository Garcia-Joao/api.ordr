import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { CompanyLicenseStatus, CompanyType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

const ADMIN_COOKIE_NAME = 'admin_auth'

type CreateAdminUserInput = {
  username: string
  password: string
  name?: string | null
}

type CreateUserInput = {
  username: string
  password: string
  name?: string | null
  phone?: string | null
  companyId?: string | null
  systemRole?: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  role?: 'admin' | 'cashier' | 'waiter'
}

type LoginAdminInput = {
  username: string
  password: string
}

type CreateLicensePlanInput = {
  name: string
  slug: string
  description?: string | null
  durationMonths?: number | null
  isLifetime?: boolean
  active?: boolean
  adminId?: string
}

type UpdateLicensePlanInput = Partial<CreateLicensePlanInput>

type CreateCompanyInput = {
  name: string
  companyType?: CompanyType | 'BUSINESS' | 'SUPPLIER'
  isTest?: boolean
  ownerUsername: string
  ownerPassword: string
  ownerName?: string | null
  ownerPhone?: string | null
  licensePlanId?: string | null
  licenseNotes?: string | null
  licenseStartsAt?: string | Date | null
  adminId?: string
}

type UpdateCompanyAccessInput = {
  platformAccessStatus: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'CANCELLED'
  platformBlockedReason?: string | null
}

type UpdateCompanyInput = {
  name?: string
  companyType?: CompanyType | 'BUSINESS' | 'SUPPLIER'
  isTest?: boolean
  platformAccessStatus?: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'CANCELLED'
  platformBlockedReason?: string | null
}

type CompanyMembershipInput = {
  companyId: string
  userId: string
  systemRole: 'ADMIN' | 'CUSTOM'
  customRoleId?: string | null
  role?: 'admin' | 'cashier' | 'waiter'
}

type UpdateCompanyMembershipInput = Partial<Omit<CompanyMembershipInput, 'companyId' | 'userId'>>

type AssignCompanyLicenseInput = {
  companyId: string
  planId: string
  startsAt?: string | Date | null
  notes?: string | null
  adminId?: string
}

type UpdateCompanyLicenseInput = {
  planId?: string
  status?: CompanyLicenseStatus
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  notes?: string | null
}

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET

  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET_NOT_CONFIGURED')
  }

  return secret
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function addMonths(date: Date, months: number) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function parseDateInput(value: string | Date | null | undefined, fallback: Date) {
  if (!value) return fallback

  const parsed = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_LICENSE_DATE')
  }

  return parsed
}

function parseOptionalDateInput(value: string | Date | null | undefined) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_LICENSE_DATE')
  }

  return parsed
}

function buildLicenseDates(
  plan: { durationMonths: number | null; isLifetime: boolean },
  startsAtInput?: string | Date | null
) {
  const startsAt = parseDateInput(startsAtInput, new Date())

  if (plan.isLifetime) {
    return {
      startsAt,
      endsAt: null,
    }
  }

  if (!plan.durationMonths || plan.durationMonths <= 0) {
    throw new Error('LICENSE_PLAN_DURATION_INVALID')
  }

  return {
    startsAt,
    endsAt: addMonths(startsAt, plan.durationMonths),
  }
}

export async function ensureInitialPlatformAdmin() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Administrador'

  if (!username || !password) {
    console.log('[admin] ADMIN_USERNAME/ADMIN_PASSWORD not configured. Skipping admin bootstrap.')
    return null
  }

  const existing = await prisma.platformAdminUser.findUnique({
    where: { username },
  })

  if (existing) {
    console.log('[admin] Platform admin already exists:', username)
    return existing
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const admin = await prisma.platformAdminUser.create({
    data: {
      username,
      password: hashedPassword,
      name,
      role: 'OWNER',
      active: true,
    },
  })

  console.log('[admin] Platform admin created:', username)

  return admin
}

export async function createAdminUser(input: CreateAdminUserInput) {
  const username = input.username.trim()

  if (!username) {
    throw new Error('ADMIN_USERNAME_REQUIRED')
  }

  if (!input.password || input.password.length < 6) {
    throw new Error('ADMIN_PASSWORD_MIN_LENGTH')
  }

  const password = await bcrypt.hash(input.password, 10)

  const admin = await prisma.platformAdminUser.create({
    data: {
      username,
      password,
      name: input.name ?? null,
      role: 'OWNER',
      active: true,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  })

  return {
    ok: true,
    admin,
  }
}


export async function createUser(input: CreateUserInput) {
  const username = input.username.trim()

  if (!username) {
    throw new Error('USERNAME_REQUIRED')
  }

  if (!input.password || input.password.length < 6) {
    throw new Error('PASSWORD_MIN_LENGTH')
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  })

  if (existingUser) {
    throw new Error('USERNAME_ALREADY_EXISTS')
  }

  const company = input.companyId
    ? await prisma.company.findUnique({
        where: { id: input.companyId },
        select: { id: true },
      })
    : null

  if (input.companyId && !company) {
    throw new Error('COMPANY_NOT_FOUND')
  }

  const resolved = input.companyId
    ? await resolveMembershipRole(input.companyId, input.systemRole ?? 'ADMIN', input.customRoleId ?? null)
    : null

  const password = await bcrypt.hash(input.password, 10)

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        password,
        name: input.name ?? null,
        phone: input.phone ?? null,
        role: input.role ?? resolved?.role ?? 'cashier',
      },
    })

    if (input.companyId && resolved) {
      await tx.userCompany.create({
        data: {
          userId: user.id,
          companyId: input.companyId,
          role: input.role ?? resolved.role,
          systemRole: resolved.systemRole,
          customRoleId: resolved.customRoleId,
        },
      })
    }

    return user
  })

  const user = await prisma.user.findUnique({
    where: { id: createdUser.id },
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      photoBase64: true,
      createdAt: true,
      role: true,
      memberships: {
        include: {
          company: {
            select: {
              id: true,
              name: true,
              isTest: true,
              platformAccessStatus: true,
            },
          },
          customRole: {
            select: {
              id: true,
              name: true,
              description: true,
              active: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      _count: {
        select: {
          memberships: true,
        },
      },
    },
  })

  return {
    ok: true,
    user,
  }
}

export async function loginAdmin(input: LoginAdminInput) {
  const username = input.username.trim()

  const admin = await prisma.platformAdminUser.findUnique({
    where: { username },
  })

  if (!admin || !admin.active) {
    throw new Error('ADMIN_INVALID_CREDENTIALS')
  }

  const validPassword = await bcrypt.compare(input.password, admin.password)

  if (!validPassword) {
    throw new Error('ADMIN_INVALID_CREDENTIALS')
  }

  const token = jwt.sign(
    {
      adminId: admin.id,
    },
    getAdminJwtSecret(),
    {
      expiresIn: '7d',
    }
  )

  return {
    ok: true,
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    },
  }
}

export async function listLicensePlans() {
  const plans = await prisma.licensePlan.findMany({
    orderBy: [
      { active: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return {
    ok: true,
    plans,
  }
}

export async function createLicensePlan(input: CreateLicensePlanInput) {
  const name = input.name.trim()

  if (!name) {
    throw new Error('LICENSE_PLAN_NAME_REQUIRED')
  }

  const slug = normalizeSlug(input.slug || name)

  if (!slug) {
    throw new Error('LICENSE_PLAN_SLUG_REQUIRED')
  }

  const isLifetime = Boolean(input.isLifetime)

  if (!isLifetime && (!input.durationMonths || input.durationMonths <= 0)) {
    throw new Error('LICENSE_PLAN_DURATION_REQUIRED')
  }

  const plan = await prisma.licensePlan.create({
    data: {
      name,
      slug,
      description: input.description ?? null,
      durationMonths: isLifetime ? null : input.durationMonths,
      isLifetime,
      active: input.active ?? true,
      createdByAdminId: input.adminId,
    },
  })

  return {
    ok: true,
    plan,
  }
}

export async function updateLicensePlan(id: string, input: UpdateLicensePlanInput) {
  const data: Prisma.LicensePlanUpdateInput = {}

  if (input.name !== undefined) {
    data.name = input.name.trim()
  }

  if (input.slug !== undefined) {
    data.slug = normalizeSlug(input.slug)
  }

  if (input.description !== undefined) {
    data.description = input.description ?? null
  }

  if (input.isLifetime !== undefined) {
    data.isLifetime = input.isLifetime
    if (input.isLifetime) {
      data.durationMonths = null
    }
  }

  if (input.durationMonths !== undefined) {
    data.durationMonths = input.durationMonths
  }

  if (input.active !== undefined) {
    data.active = input.active
  }

  const plan = await prisma.licensePlan.update({
    where: { id },
    data,
  })

  return {
    ok: true,
    plan,
  }
}


function companyIncludeOptions() {
  return {
    memberships: {
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            createdAt: true,
            role: true,
          },
        },
        customRole: {
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc' as const,
      },
    },
    accessRoles: {
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
      },
      orderBy: {
        name: 'asc' as const,
      },
    },
    platformLicenses: {
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc' as const,
      },
      take: 1,
    },
    testCompanies: {
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    },
    _count: {
      select: {
        orders: true,
        products: true,
        customers: true,
        memberships: true,
        eventDates: true,
      },
    },
  }
}

async function getCompanyForAdmin(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: companyIncludeOptions(),
  })

  if (!company) {
    throw new Error('COMPANY_NOT_FOUND')
  }

  return company
}

async function resolveMembershipRole(
  companyId: string,
  systemRole?: 'ADMIN' | 'CUSTOM',
  customRoleId?: string | null
) {
  const resolvedSystemRole = systemRole ?? 'ADMIN'

  if (resolvedSystemRole === 'ADMIN') {
    return {
      systemRole: 'ADMIN' as const,
      customRoleId: null,
      role: 'admin' as const,
    }
  }

  if (!customRoleId) {
    throw new Error('CUSTOM_ROLE_REQUIRED')
  }

  const role = await prisma.role.findFirst({
    where: {
      id: customRoleId,
      companyId,
      active: true,
    },
    select: {
      id: true,
    },
  })

  if (!role) {
    throw new Error('ROLE_NOT_FOUND')
  }

  return {
    systemRole: 'CUSTOM' as const,
    customRoleId: role.id,
    role: 'cashier' as const,
  }
}

async function getMembershipForAdmin(membershipId: string) {
  const membership = await prisma.userCompany.findUnique({
    where: { id: membershipId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          isTest: true,
          platformAccessStatus: true,
        },
      },
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          createdAt: true,
          role: true,
        },
      },
      customRole: {
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
        },
      },
    },
  })

  if (!membership) {
    throw new Error('MEMBERSHIP_NOT_FOUND')
  }

  return membership
}

export async function listCompanies() {
  const companies = await prisma.company.findMany({
    include: companyIncludeOptions(),
    orderBy: {
      createdAt: 'desc',
    },
  })

  return {
    ok: true,
    companies,
  }
}

export async function getCompany(companyId: string) {
  const company = await getCompanyForAdmin(companyId)

  return {
    ok: true,
    company,
  }
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      photoBase64: true,
      createdAt: true,
      role: true,
      memberships: {
        include: {
          company: {
            select: {
              id: true,
              name: true,
              isTest: true,
              platformAccessStatus: true,
            },
          },
          customRole: {
            select: {
              id: true,
              name: true,
              description: true,
              active: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      _count: {
        select: {
          memberships: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return {
    ok: true,
    users,
  }
}

export async function updateCompany(companyId: string, input: UpdateCompanyInput) {
  const data: Prisma.CompanyUpdateInput = {}

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('COMPANY_NAME_REQUIRED')
    data.name = name
  }

  if (input.companyType !== undefined) {
    data.companyType = input.companyType
  }

  if (input.isTest !== undefined) {
    data.isTest = input.isTest
  }

  if (input.platformAccessStatus !== undefined) {
    const blocked =
      input.platformAccessStatus === 'BLOCKED' ||
      input.platformAccessStatus === 'SUSPENDED' ||
      input.platformAccessStatus === 'CANCELLED'

    data.platformAccessStatus = input.platformAccessStatus
    data.platformBlockedAt = blocked ? new Date() : null
    data.platformBlockedReason = blocked ? input.platformBlockedReason ?? null : null
  } else if (input.platformBlockedReason !== undefined) {
    data.platformBlockedReason = input.platformBlockedReason ?? null
  }

  await prisma.company.update({
    where: { id: companyId },
    data,
  })

  const company = await getCompanyForAdmin(companyId)

  return {
    ok: true,
    company,
  }
}

export async function upsertCompanyMembership(input: CompanyMembershipInput) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true } })
  if (!company) throw new Error('COMPANY_NOT_FOUND')

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } })
  if (!user) throw new Error('USER_NOT_FOUND')

  const resolved = await resolveMembershipRole(input.companyId, input.systemRole, input.customRoleId ?? null)

  const membership = await prisma.userCompany.upsert({
    where: {
      userId_companyId: {
        userId: input.userId,
        companyId: input.companyId,
      },
    },
    create: {
      userId: input.userId,
      companyId: input.companyId,
      role: input.role ?? resolved.role,
      systemRole: resolved.systemRole,
      customRoleId: resolved.customRoleId,
    },
    update: {
      role: input.role ?? resolved.role,
      systemRole: resolved.systemRole,
      customRoleId: resolved.customRoleId,
    },
  })

  return {
    ok: true,
    membership: await getMembershipForAdmin(membership.id),
  }
}

export async function updateCompanyMembership(membershipId: string, input: UpdateCompanyMembershipInput) {
  const existing = await prisma.userCompany.findUnique({
    where: { id: membershipId },
    select: { id: true, companyId: true, systemRole: true, customRoleId: true },
  })

  if (!existing) throw new Error('MEMBERSHIP_NOT_FOUND')

  const resolved = await resolveMembershipRole(
    existing.companyId,
    input.systemRole ?? existing.systemRole,
    input.systemRole === 'ADMIN' ? null : input.customRoleId ?? existing.customRoleId
  )

  const membership = await prisma.userCompany.update({
    where: { id: membershipId },
    data: {
      role: input.role ?? resolved.role,
      systemRole: resolved.systemRole,
      customRoleId: resolved.customRoleId,
    },
  })

  return {
    ok: true,
    membership: await getMembershipForAdmin(membership.id),
  }
}

export async function deleteCompanyMembership(membershipId: string) {
  await prisma.userCompany.delete({
    where: { id: membershipId },
  })

  return {
    ok: true,
  }
}

export async function createCompanyWithInitialAccess(input: CreateCompanyInput) {
  const companyName = input.name.trim()
  const ownerUsername = input.ownerUsername.trim()

  if (!companyName) {
    throw new Error('COMPANY_NAME_REQUIRED')
  }

  if (!ownerUsername) {
    throw new Error('OWNER_USERNAME_REQUIRED')
  }

  if (!input.ownerPassword || input.ownerPassword.length < 6) {
    throw new Error('OWNER_PASSWORD_MIN_LENGTH')
  }

  const existingUser = await prisma.user.findUnique({
    where: { username: ownerUsername },
  })

  if (existingUser) {
    throw new Error('OWNER_USERNAME_ALREADY_EXISTS')
  }

  const plan = input.licensePlanId
    ? await prisma.licensePlan.findUnique({
        where: { id: input.licensePlanId },
      })
    : null

  if (input.licensePlanId && !plan) {
    throw new Error('LICENSE_PLAN_NOT_FOUND')
  }

  if (plan && !plan.active) {
    throw new Error('LICENSE_PLAN_INACTIVE')
  }

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        companyType: input.companyType ?? 'BUSINESS',
        isTest: input.isTest ?? false,
        platformAccessStatus: 'ACTIVE',
      },
    })

    const password = await bcrypt.hash(input.ownerPassword, 10)

    const user = await tx.user.create({
      data: {
        username: ownerUsername,
        password,
        name: input.ownerName ?? null,
        phone: input.ownerPhone ?? null,
        role: 'admin',
      },
    })

    const membership = await tx.userCompany.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: 'admin',
        systemRole: 'ADMIN',
      },
    })

    const defaultEnvironment = await tx.salesEnvironment.create({
      data: {
        companyId: company.id,
        name: 'Default',
        color: '#dd7c12',
        isDefault: true,
        active: true,
      },
    })

    let license = null

    if (plan) {
      await tx.companyLicense.updateMany({
        where: {
          companyId: company.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'REPLACED',
        },
      })

      const { startsAt, endsAt } = buildLicenseDates(plan, input.licenseStartsAt)

      license = await tx.companyLicense.create({
        data: {
          companyId: company.id,
          planId: plan.id,
          status: 'ACTIVE',
          startsAt,
          endsAt,
          notes: input.licenseNotes ?? null,
          createdByAdminId: input.adminId,
        },
        include: {
          plan: true,
        },
      })
    }

    return {
      company,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      membership,
      defaultEnvironment,
      license,
    }
  })

  return {
    ok: true,
    ...result,
  }
}

export async function updateCompanyAccess(companyId: string, input: UpdateCompanyAccessInput) {
  const blocked =
    input.platformAccessStatus === 'BLOCKED' ||
    input.platformAccessStatus === 'SUSPENDED' ||
    input.platformAccessStatus === 'CANCELLED'

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      platformAccessStatus: input.platformAccessStatus,
      platformBlockedAt: blocked ? new Date() : null,
      platformBlockedReason: blocked ? input.platformBlockedReason ?? null : null,
    },
  })

  return {
    ok: true,
    company,
  }
}

export async function assignCompanyLicense(input: AssignCompanyLicenseInput) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
  })

  if (!company) {
    throw new Error('COMPANY_NOT_FOUND')
  }

  const plan = await prisma.licensePlan.findUnique({
    where: { id: input.planId },
  })

  if (!plan) {
    throw new Error('LICENSE_PLAN_NOT_FOUND')
  }

  if (!plan.active) {
    throw new Error('LICENSE_PLAN_INACTIVE')
  }

  const { startsAt, endsAt } = buildLicenseDates(plan, input.startsAt)

  const result = await prisma.$transaction(async (tx) => {
    await tx.companyLicense.updateMany({
      where: {
        companyId: input.companyId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REPLACED',
      },
    })

    const license = await tx.companyLicense.create({
      data: {
        companyId: input.companyId,
        planId: input.planId,
        status: 'ACTIVE',
        startsAt,
        endsAt,
        notes: input.notes ?? null,
        createdByAdminId: input.adminId,
      },
      include: {
        plan: true,
        company: true,
      },
    })

    await tx.company.update({
      where: {
        id: input.companyId,
      },
      data: {
        platformAccessStatus: 'ACTIVE',
        platformBlockedAt: null,
        platformBlockedReason: null,
      },
    })

    return license
  })

  return {
    ok: true,
    license: result,
  }
}

export async function updateCompanyLicense(licenseId: string, input: UpdateCompanyLicenseInput) {
  const existing = await prisma.companyLicense.findUnique({
    where: { id: licenseId },
    include: { plan: true },
  })

  if (!existing) {
    throw new Error('LICENSE_NOT_FOUND')
  }

  const plan = input.planId
    ? await prisma.licensePlan.findUnique({ where: { id: input.planId } })
    : existing.plan

  if (!plan) {
    throw new Error('LICENSE_PLAN_NOT_FOUND')
  }

  if (!plan.active) {
    throw new Error('LICENSE_PLAN_INACTIVE')
  }

  const data: Prisma.CompanyLicenseUpdateInput = {}

  if (input.planId !== undefined) {
    data.plan = { connect: { id: plan.id } }
  }

  if (input.status !== undefined) {
    data.status = input.status
  }

  const startsAtChanged = input.startsAt !== undefined
  const endsAtProvided = input.endsAt !== undefined

  if (startsAtChanged) {
    const startsAt = parseDateInput(input.startsAt, existing.startsAt)
    data.startsAt = startsAt

    if (!endsAtProvided) {
      data.endsAt = plan.isLifetime ? null : buildLicenseDates(plan, startsAt).endsAt
    }
  } else if (input.planId !== undefined && !endsAtProvided) {
    data.endsAt = plan.isLifetime ? null : buildLicenseDates(plan, existing.startsAt).endsAt
  }

  if (endsAtProvided) {
    data.endsAt = parseOptionalDateInput(input.endsAt)
  }

  if (input.notes !== undefined) {
    data.notes = input.notes ?? null
  }

  const license = await prisma.companyLicense.update({
    where: { id: licenseId },
    data,
    include: {
      plan: true,
      company: true,
      createdByAdmin: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  })

  if (license.status === 'ACTIVE') {
    await prisma.companyLicense.updateMany({
      where: {
        companyId: license.companyId,
        status: 'ACTIVE',
        id: { not: license.id },
      },
      data: { status: 'REPLACED' },
    })

    await prisma.company.update({
      where: { id: license.companyId },
      data: {
        platformAccessStatus: 'ACTIVE',
        platformBlockedAt: null,
        platformBlockedReason: null,
      },
    })
  }

  return {
    ok: true,
    license,
  }
}

export async function getAdminMe(adminId: string) {
  const admin = await prisma.platformAdminUser.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  })

  if (!admin || !admin.active) {
    throw new Error('ADMIN_NOT_FOUND')
  }

  return {
    ok: true,
    admin,
  }
}

export { ADMIN_COOKIE_NAME }