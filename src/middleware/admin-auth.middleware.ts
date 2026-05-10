import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

type AdminJwtPayload = {
  adminId?: string
}

export type AdminAuthRequest = Request & {
  admin?: {
    id: string
    username: string
    name: string | null
    role: string
  }
}

export async function requirePlatformAdmin(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.admin_auth

    if (!token) {
      return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED' })
    }

    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET

    if (!secret) {
      return res.status(500).json({ error: 'ADMIN_JWT_SECRET_NOT_CONFIGURED' })
    }

    const decoded = jwt.verify(token, secret) as AdminJwtPayload

    if (!decoded.adminId) {
      return res.status(401).json({ error: 'ADMIN_INVALID_TOKEN' })
    }

    const admin = await prisma.platformAdminUser.findUnique({
      where: { id: decoded.adminId },
    })

    if (!admin || !admin.active) {
      return res.status(401).json({ error: 'ADMIN_NOT_FOUND_OR_INACTIVE' })
    }

    req.admin = {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    }

    return next()
  } catch (error) {
    console.error('[admin-auth] error:', error)
    return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED' })
  }
}