import { NextFunction, Request, Response } from 'express'
import * as authService from '../services/auth.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
    currentCompany?: {
      licenseActive?: boolean
      licenseStatus?: string
      licensePlanName?: string | null
      licenseEndsAt?: string | null
      platformAccessStatus?: string
      platformBlockedReason?: string | null
    } | null
  }
}

const COOKIE_NAME = 'auth'

function getBearerToken(req: Request) {
  const authorization = req.headers.authorization

  if (typeof authorization !== 'string') {
    return null
  }

  if (!authorization.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim() || null
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const bearerToken = getBearerToken(req)
    const cookieToken = req.cookies?.[COOKIE_NAME]
    const token = bearerToken || cookieToken

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await authService.getUserFromToken(token)

    req.user = user

    const canPassInactiveLicense =
      req.baseUrl === '/auth' &&
      (req.path === '/me' || req.path === '/switch-company' || req.path === '/logout')

    if (!user.currentCompany?.licenseActive && !canPassInactiveLicense) {
      return res.status(403).json({
        error: 'COMPANY_LICENSE_INACTIVE',
        company: user.currentCompany ?? null,
      })
    }

    return next()
  } catch (error: any) {
    if (error?.message === 'ADMIN_ACCESS_REQUIRED') {
      return res.status(403).json({ error: 'ADMIN_ACCESS_REQUIRED' })
    }

    return res.status(401).json({ error: 'Unauthorized' })
  }
}