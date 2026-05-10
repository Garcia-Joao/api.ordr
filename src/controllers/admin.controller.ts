import { Request, Response } from 'express'
import {
  ADMIN_COOKIE_NAME,
  assignCompanyLicense,
  createAdminUser,
  createCompanyWithInitialAccess,
  createLicensePlan,
  getAdminMe,
  getCompany,
  listCompanies,
  listLicensePlans,
  loginAdmin,
  updateCompanyAccess,
  updateLicensePlan,
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
    const result = await createAdminUser(req.body)

    return res.status(201).json(result)
  } catch (error: any) {
    console.error('[admin] create user error:', error)

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