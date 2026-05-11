import { Request, Response } from 'express'
import * as printersService from '../services/printers.service'

type AuthRequest = Request & {
  user?: {
    id: string
    companyId: string
  }
}

function getParam(value: string | string[] | undefined) {
  if (!value) return ''
  return Array.isArray(value) ? value[0] : value
}

export async function getSystemPrinters(_req: Request, res: Response) {
  try {
    const printers = await printersService.getSystemPrinters()
    return res.json(printers)
  } catch (error: any) {
    console.error('getSystemPrinters error:', error)
    return res.status(500).json({ error: error?.message || 'Failed to fetch system printers' })
  }
}

export async function getPrintTerminals(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const terminals = await printersService.getPrintTerminals(companyId)
    return res.json({ terminals })
  } catch (error: any) {
    console.error('getPrintTerminals error:', error)
    return res.status(500).json({ error: error?.message || 'Failed to fetch terminals' })
  }
}

export async function listPrintPorts(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const ports = await printersService.listPrintPorts(companyId)
    return res.json({ ports })
  } catch (error: any) {
    console.error('listPrintPorts error:', error)
    return res.status(500).json({ error: error?.message || 'Failed to fetch print ports' })
  }
}

export async function createPrintPort(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const port = await printersService.createPrintPort(companyId, req.body)
    return res.status(201).json({ port })
  } catch (error: any) {
    console.error('createPrintPort error:', error)
    if (error?.message === 'PRINT_PORT_NAME_REQUIRED') return res.status(400).json({ error: 'Nome da port é obrigatório.' })
    if (error?.message === 'PRINT_TERMINAL_NOT_FOUND') return res.status(400).json({ error: 'Terminal de impressão inválido ou offline.' })
    return res.status(500).json({ error: error?.message || 'Failed to create print port' })
  }
}

export async function updatePrintPort(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const portId = getParam(req.params.id)
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const port = await printersService.updatePrintPort(companyId, portId, req.body)
    return res.json({ port })
  } catch (error: any) {
    console.error('updatePrintPort error:', error)
    if (error?.message === 'PRINT_PORT_NOT_FOUND') return res.status(404).json({ error: 'Port não encontrada.' })
    if (error?.message === 'PRINT_TERMINAL_NOT_FOUND') return res.status(400).json({ error: 'Terminal de impressão inválido ou offline.' })
    return res.status(500).json({ error: error?.message || 'Failed to update print port' })
  }
}

export async function bindPrintPort(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const portId = getParam(req.params.id)
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const port = await printersService.bindPrintPort(companyId, portId, req.body)
    return res.json({ port })
  } catch (error: any) {
    console.error('bindPrintPort error:', error)
    if (error?.message === 'PRINT_PORT_NOT_FOUND') return res.status(404).json({ error: 'Port não encontrada.' })
    if (error?.message === 'PRINT_TERMINAL_NOT_FOUND') return res.status(400).json({ error: 'Terminal de impressão inválido ou offline.' })
    return res.status(500).json({ error: error?.message || 'Failed to bind print port' })
  }
}

export async function setPrintPortBindings(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const portId = getParam(req.params.id)
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const port = await printersService.setPrintPortBindings(companyId, portId, {
      terminalDeviceId: typeof req.body?.terminalDeviceId === 'string' ? req.body.terminalDeviceId : null,
      printers: Array.isArray(req.body?.printers) ? req.body.printers : [],
    })

    return res.json({ port })
  } catch (error: any) {
    console.error('setPrintPortBindings error:', error)
    if (error?.message === 'PRINT_PORT_NOT_FOUND') return res.status(404).json({ error: 'Port não encontrada.' })
    if (error?.message === 'PRINT_TERMINAL_NOT_FOUND') return res.status(400).json({ error: 'Terminal de impressão inválido ou offline.' })
    return res.status(500).json({ error: error?.message || 'Failed to bind print port printers' })
  }
}

export async function deletePrintPort(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const portId = getParam(req.params.id)
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const result = await printersService.deletePrintPort(companyId, portId)
    return res.json(result)
  } catch (error: any) {
    console.error('deletePrintPort error:', error)
    if (error?.message === 'PRINT_PORT_NOT_FOUND') return res.status(404).json({ error: 'Port não encontrada.' })
    return res.status(500).json({ error: error?.message || 'Failed to delete print port' })
  }
}

export async function getPrinterSettings(req: AuthRequest, res: Response) {
  try {
    const settings = await printersService.getPrinterSettings(req.user?.companyId)
    return res.json(settings)
  } catch (error: any) {
    console.error('getPrinterSettings error:', error)
    return res.status(500).json({ error: error?.message || 'Failed to fetch printer settings' })
  }
}

export async function savePrinterSettings(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const settings = await printersService.savePrinterSettings(companyId, req.body)
    return res.json(settings)
  } catch (error: any) {
    console.error('savePrinterSettings error:', error)
    return res.status(500).json({ error: error?.message || 'Failed to save printer settings' })
  }
}

export async function testPrinter(req: Request, res: Response) {
  try {
    const { printerName } = req.body as { printerName?: string }
    const result = await printersService.testPrinter(printerName)
    return res.json(result)
  } catch (error: any) {
    console.error('testPrinter error:', error)
    if (error?.message === 'PRINTER_NOT_CONFIGURED') return res.status(400).json({ error: 'Printer not configured' })
    return res.status(500).json({ error: error?.message || 'Failed to test printer' })
  }
}
