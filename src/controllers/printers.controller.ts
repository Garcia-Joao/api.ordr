import { Request, Response } from 'express'
import * as printersService from '../services/printers.service'

export async function getSystemPrinters(_req: Request, res: Response) {
  try {
    const printers = await printersService.getSystemPrinters()
    return res.json(printers)
  } catch (error: any) {
    console.error('getSystemPrinters error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to fetch system printers',
    })
  }
}

export async function getPrinterSettings(_req: Request, res: Response) {
  try {
    const settings = await printersService.getPrinterSettings()
    return res.json(settings)
  } catch (error: any) {
    console.error('getPrinterSettings error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to fetch printer settings',
    })
  }
}

export async function savePrinterSettings(req: Request, res: Response) {
  try {
    const settings = await printersService.savePrinterSettings(req.body)
    return res.json(settings)
  } catch (error: any) {
    console.error('savePrinterSettings error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to save printer settings',
    })
  }
}

export async function testPrinter(req: Request, res: Response) {
  try {
    const { printerName } = req.body as {
      printerName?: string
    }

    const result = await printersService.testPrinter(printerName)
    return res.json(result)
  } catch (error: any) {
    console.error('testPrinter error:', error)

    if (error?.message === 'PRINTER_NOT_CONFIGURED') {
      return res.status(400).json({ error: 'Printer not configured' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to test printer',
    })
  }
}