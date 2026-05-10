import { Request, Response } from 'express'
import * as devicesService from '../services/devices.service'

type AuthRequest = Request & {
  user?: {
    id: string
    companyId: string
  }
}

function getIpAddress(req: Request) {
  const forwarded = req.headers['x-forwarded-for']

  if (Array.isArray(forwarded)) {
    return forwarded[0] ?? null
  }

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || null
  }

  return req.socket.remoteAddress ?? null
}

function getStringValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() || null
  }

  if (Array.isArray(value)) {
    const firstValue = value[0]

    if (typeof firstValue === 'string') {
      return firstValue.trim() || null
    }
  }

  return null
}

export async function heartbeat(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await devicesService.heartbeatDevice({
      companyId,
      userId,
      deviceId: getStringValue(req.body?.deviceId),
      name: getStringValue(req.body?.name),
      type: getStringValue(req.body?.type),
      browser: getStringValue(req.body?.browser),
      os: getStringValue(req.body?.os),
      userAgent:
        getStringValue(req.body?.userAgent) ??
        getStringValue(req.headers['user-agent']),
      ipAddress: getIpAddress(req),
      clientType: getStringValue(req.body?.clientType),
      isPrintTerminal: Boolean(req.body?.isPrintTerminal),
      printTerminalEnabled: Boolean(req.body?.printTerminalEnabled),
      localPrinters: Array.isArray(req.body?.localPrinters) ? req.body.localPrinters : [],
    })

    return res.json({ device: result })
  } catch (error: any) {
    console.error('device heartbeat error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to update device heartbeat',
    })
  }
}

export async function listDevices(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const devices = await devicesService.listCompanyDevices(companyId)

    return res.json({ devices })
  } catch (error: any) {
    console.error('list devices error:', error)

    return res.status(500).json({
      error: error?.message || 'Failed to list devices',
    })
  }
}

export async function deleteDevice(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const deviceId =
      getStringValue(req.params?.deviceId) ??
      getStringValue(req.query?.deviceId) ??
      getStringValue(req.body?.deviceId)

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId é obrigatório.' })
    }

    const result = await devicesService.deleteCompanyDevice({
      companyId,
      userId,
      deviceId,
    })

    return res.json(result)
  } catch (error: any) {
    console.error('delete device error:', error)

    if (error?.message === 'DEVICE_NOT_FOUND') {
      return res.status(404).json({ error: 'Dispositivo não encontrado.' })
    }

    if (error?.message === 'ADMIN_ACCESS_REQUIRED') {
      return res.status(403).json({
        error: 'Somente administradores podem remover dispositivos.',
      })
    }

    if (error?.message === 'COMPANY_ACCESS_DENIED') {
      return res.status(403).json({ error: 'Acesso negado à empresa.' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to delete device',
    })
  }
}