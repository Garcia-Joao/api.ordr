import { Request, Response } from 'express'
import * as menusService from '../services/menus.service'

type AuthRequest = Request & { user?: { id: string; companyId: string } }

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || ''
}

function handleError(res: Response, error: any) {
  const message = error?.message || 'Erro no cardápio.'
  if (message === 'MENU_NOT_FOUND') return res.status(404).json({ error: message })
  if ([
    'MENU_NAME_REQUIRED',
    'MENU_PRODUCT_NOT_FOUND',
    'ACTIVE_MENU_CANNOT_BE_DELETED',
  ].includes(message)) return res.status(400).json({ error: message })
  if (error?.code === 'P2002') return res.status(400).json({ error: 'MENU_DUPLICATED' })
  return res.status(500).json({ error: message })
}

export async function listMenus(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    return res.json({ menus: await menusService.listMenus(companyId) })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export async function getActiveMenu(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    return res.json({ menu: await menusService.getActiveMenu(companyId) })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export async function getMenu(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    return res.json({ menu: await menusService.getMenu(companyId, param(req.params.id)) })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export async function createMenu(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    return res.status(201).json({ menu: await menusService.createMenu(companyId, req.body) })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export async function updateMenu(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    return res.json({ menu: await menusService.updateMenu(companyId, param(req.params.id), req.body) })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export async function activateMenu(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    return res.json({ menu: await menusService.activateMenu(companyId, param(req.params.id)) })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export async function deleteMenu(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    return res.json(await menusService.deleteMenu(companyId, param(req.params.id)))
  } catch (error: any) {
    return handleError(res, error)
  }
}
