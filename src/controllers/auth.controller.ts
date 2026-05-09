import { Request, Response } from 'express'
import * as authService from '../services/auth.service'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  maxAge: 1000 * 60 * 60 * 24 * 7,
}

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    name?: string | null
    phone?: string | null
    photoBase64?: string | null
    role: string
    companyId: string
    companies?: Array<{
      id: string
      name: string
      isTest: boolean
      role: string
    }>
  }
}

const COOKIE_NAME = 'auth'

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body as {
      username?: string
      password?: string
    }

    if (!username || !password) {
      return res.status(400).json({
        error: 'username and password are required',
      })
    }

    const result = await authService.loginUser(username, password)

    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS)

    return res.json({
      user: result.user,
    })
  } catch (error: any) {
    if (error?.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (error?.message === 'USER_WITHOUT_COMPANY') {
      return res.status(400).json({ error: 'User is not linked to any company' })
    }

    console.error(error)
    return res.status(500).json({ error: error?.message || 'Failed to login' })
  }
}

export async function logout(_req: Request, res: Response) {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    })

    return res.json({ ok: true })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Failed to logout' })
  }
}

export async function me(req: AuthRequest, res: Response) {
  return res.json({
    user: req.user,
  })
}

export async function switchCompany(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id
    const { companyId } = req.body as { companyId?: string }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' })
    }

    const result = await authService.switchUserCompany(userId, companyId)

    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    })

    return res.json({
      user: result.user,
    })
  } catch (error: any) {
    if (error?.message === 'COMPANY_ACCESS_DENIED') {
      return res.status(403).json({ error: 'Access denied to this company' })
    }

    console.error(error)
    return res.status(500).json({ error: error?.message || 'Failed to switch company' })
  }
}

export async function updateMe(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { name, username, phone, photoBase64, currentPassword, newPassword } =
      req.body as {
        name?: string
        username?: string
        phone?: string
        photoBase64?: string | null
        currentPassword?: string
        newPassword?: string
      }

    const updatedUser = await authService.updateMyAccount({
      userId,
      name,
      username,
      phone,
      photoBase64,
      currentPassword,
      newPassword,
    })

    return res.json({
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('updateMe error:', error)

    if (error?.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found' })
    }

    if (error?.message === 'USERNAME_ALREADY_EXISTS') {
      return res.status(409).json({ error: 'Username already exists' })
    }

    if (error?.message === 'USER_WITHOUT_COMPANY') {
      return res.status(400).json({ error: 'User is not linked to any company' })
    }

    if (error?.message === 'PHOTO_TOO_LARGE') {
      return res.status(400).json({ error: 'Photo is too large' })
    }

    if (error?.message === 'USERNAME_REQUIRED') {
      return res.status(400).json({ error: 'Username is required' })
    }

    if (error?.message === 'CURRENT_PASSWORD_REQUIRED') {
      return res.status(400).json({ error: 'Current password is required' })
    }

    if (error?.message === 'INVALID_CURRENT_PASSWORD') {
      return res.status(400).json({ error: 'Current password is invalid' })
    }

    if (error?.message === 'NEW_PASSWORD_REQUIRED') {
      return res.status(400).json({ error: 'New password is required' })
    }

    if (error?.message === 'PASSWORD_TOO_SHORT') {
      return res.status(400).json({ error: 'New password is too short' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to update account',
    })
  }
}