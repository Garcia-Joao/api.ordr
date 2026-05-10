import { Request, Response } from 'express'
import {
  ADMIN_COOKIE_NAME,
  assignCompanyLicense,
  createCompanyWithInitialAccess,
  createLicensePlan,
  createUser,
  getAdminMe,
  deleteCompanyMembership,
  getCompany,
  listCompanies,
  listLicensePlans,
  listUsers,
  loginAdmin,
  updateCompany,
  updateCompanyAccess,
  updateCompanyMembership,
  updateLicensePlan,
  upsertCompanyMembership,
} from '../services/admin.service'
import type { AdminAuthRequest } from '../middleware/admin-auth.middleware'

function getParam(value: string | string[] | undefined, name: string) {
  if (!value) {
    throw new Error(`${name.toUpperCase()}_PARAM_REQUIRED`)
  }

  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function adminCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    domain: isProduction ? '.panelordr.com.br' : undefined,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  }
}

export async function adminLoginController(req: Request, res: Response) {
  try {
    const result = await loginAdmin(req.body)

    res.cookie(ADMIN_COOKIE_NAME, result.token, adminCookieOptions())

    return res.json({
      ok: true,
      admin: result.admin,
    })
  } catch (error: any) {
    console.error('[admin] login error:', error)

    return res.status(401).json({
      error: error?.message || 'ADMIN_LOGIN_ERROR',
    })
  }
}

export async function adminLogoutController(_req: Request, res: Response) {
  res.clearCookie(ADMIN_COOKIE_NAME, adminCookieOptions())

  return res.json({
    ok: true,
  })
}

export async function adminMeController(req: AdminAuthRequest, res: Response) {
  try {
    if (!req.admin?.id) {
      return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED' })
    }

    const result = await getAdminMe(req.admin.id)

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] me error:', error)

    return res.status(401).json({
      error: error?.message || 'ADMIN_ME_ERROR',
    })
  }
}

export async function adminCreateUserController(req: AdminAuthRequest, res: Response) {
  try {
    const result = await createUser(req.body)

    return res.status(201).json(result)
  } catch (error: any) {
    console.error('[admin] create app user error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_CREATE_USER_ERROR',
    })
  }
}

export async function adminListLicensePlansController(
  _req: AdminAuthRequest,
  res: Response
) {
  try {
    const result = await listLicensePlans()

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] list license plans error:', error)

    return res.status(500).json({
      error: error?.message || 'ADMIN_LIST_LICENSE_PLANS_ERROR',
    })
  }
}

export async function adminCreateLicensePlanController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const result = await createLicensePlan({
      ...req.body,
      adminId: req.admin?.id,
    })

    return res.status(201).json(result)
  } catch (error: any) {
    console.error('[admin] create license plan error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_CREATE_LICENSE_PLAN_ERROR',
    })
  }
}

export async function adminUpdateLicensePlanController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const id = getParam(req.params.id, 'id')
    const result = await updateLicensePlan(id, req.body)

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] update license plan error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_UPDATE_LICENSE_PLAN_ERROR',
    })
  }
}

export async function adminListCompaniesController(
  _req: AdminAuthRequest,
  res: Response
) {
  try {
    const result = await listCompanies()

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] list companies error:', error)

    return res.status(500).json({
      error: error?.message || 'ADMIN_LIST_COMPANIES_ERROR',
    })
  }
}


export async function adminListUsersController(
  _req: AdminAuthRequest,
  res: Response
) {
  try {
    const result = await listUsers()

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] list users error:', error)

    return res.status(500).json({
      error: error?.message || 'ADMIN_LIST_USERS_ERROR',
    })
  }
}

export async function adminGetCompanyController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const companyId = getParam(req.params.companyId, 'companyId')
    const result = await getCompany(companyId)

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] get company error:', error)

    return res.status(404).json({
      error: error?.message || 'ADMIN_GET_COMPANY_ERROR',
    })
  }
}

export async function adminCreateCompanyController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const result = await createCompanyWithInitialAccess({
      ...req.body,
      adminId: req.admin?.id,
    })

    return res.status(201).json(result)
  } catch (error: any) {
    console.error('[admin] create company error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_CREATE_COMPANY_ERROR',
    })
  }
}


export async function adminUpdateCompanyController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const companyId = getParam(req.params.companyId, 'companyId')
    const result = await updateCompany(companyId, req.body)

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] update company error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_UPDATE_COMPANY_ERROR',
    })
  }
}

export async function adminUpsertCompanyMembershipController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const result = await upsertCompanyMembership(req.body)

    return res.status(201).json(result)
  } catch (error: any) {
    console.error('[admin] upsert company membership error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_UPSERT_COMPANY_MEMBERSHIP_ERROR',
    })
  }
}

export async function adminUpdateCompanyMembershipController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const membershipId = getParam(req.params.membershipId, 'membershipId')
    const result = await updateCompanyMembership(membershipId, req.body)

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] update company membership error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_UPDATE_COMPANY_MEMBERSHIP_ERROR',
    })
  }
}

export async function adminDeleteCompanyMembershipController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const membershipId = getParam(req.params.membershipId, 'membershipId')
    const result = await deleteCompanyMembership(membershipId)

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] delete company membership error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_DELETE_COMPANY_MEMBERSHIP_ERROR',
    })
  }
}

export async function adminUpdateCompanyAccessController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const companyId = getParam(req.params.companyId, 'companyId')
    const result = await updateCompanyAccess(companyId, req.body)

    return res.json(result)
  } catch (error: any) {
    console.error('[admin] update company access error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_UPDATE_COMPANY_ACCESS_ERROR',
    })
  }
}

export async function adminAssignCompanyLicenseController(
  req: AdminAuthRequest,
  res: Response
) {
  try {
    const companyId = getParam(req.params.companyId, 'companyId')

    const result = await assignCompanyLicense({
      companyId,
      planId: req.body.planId,
      notes: req.body.notes,
      adminId: req.admin?.id,
    })

    return res.status(201).json(result)
  } catch (error: any) {
    console.error('[admin] assign company license error:', error)

    return res.status(400).json({
      error: error?.message || 'ADMIN_ASSIGN_COMPANY_LICENSE_ERROR',
    })
  }
}