import { NextFunction, Request, Response } from 'express'
import * as authService from '../services/auth.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

const COOKIE_NAME = 'auth'

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.[COOKIE_NAME]

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await authService.getUserFromToken(token)

    req.user = user

    return next()
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}