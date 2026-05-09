import fs from 'fs/promises'
import path from 'path'

const {
  listGenericTextPrinters,
  printRawThermalText,
} = require('../../printer.js')

const DATA_DIR = path.resolve(process.cwd(), 'data')
const SETTINGS_FILE = path.join(DATA_DIR, 'printer-settings.json')

export type RegisteredPrinter = {
  id: string
  name: string
  systemName: string
  driverName?: string | null
  portName?: string | null
  paperWidth: 58 | 80
  type: 'orders' | 'kitchen' | 'bar'
}

export type OrderTicketTemplate = {
  showLogo: boolean
  showOrderId: boolean
  showDate: boolean
  showComandaName: boolean
  showVariations: boolean
  showNotes: boolean
  headerText: string
  footerText: string
}

export type PrinterSettings = {
  printers: RegisteredPrinter[]
  orderPrinterId: string | null
  orderTicketTemplate: OrderTicketTemplate
}

const defaultSettings: PrinterSettings = {
  printers: [],
  orderPrinterId: null,
  orderTicketTemplate: {
    showLogo: true,
    showOrderId: true,
    showDate: true,
    showComandaName: true,
    showVariations: true,
    showNotes: true,
    headerText: '*** ORDR ***',
    footerText: '',
  },
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readSettings(): Promise<PrinterSettings> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8')
    const parsed = JSON.parse(content)

    return {
      ...defaultSettings,
      ...parsed,
      orderTicketTemplate: {
        ...defaultSettings.orderTicketTemplate,
        ...(parsed.orderTicketTemplate ?? {}),
      },
      printers: Array.isArray(parsed.printers) ? parsed.printers : [],
    }
  } catch {
    return defaultSettings
  }
}

async function writeSettings(settings: PrinterSettings) {
  await ensureDataDir()
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
}

export async function getSystemPrinters() {
  return await listGenericTextPrinters()
}

export async function getPrinterSettings() {
  return await readSettings()
}

export async function savePrinterSettings(input: PrinterSettings) {
  const settings: PrinterSettings = {
    printers: Array.isArray(input.printers) ? input.printers : [],
    orderPrinterId: input.orderPrinterId ?? null,
    orderTicketTemplate: {
      ...defaultSettings.orderTicketTemplate,
      ...(input.orderTicketTemplate ?? {}),
    },
  }

  await writeSettings(settings)
  return settings
}

export async function getSelectedOrderPrinter() {
  const settings = await readSettings()

  if (!settings.orderPrinterId) return null

  return (
    settings.printers.find((printer) => printer.id === settings.orderPrinterId) ??
    null
  )
}

export async function getOrderTicketTemplate() {
  const settings = await readSettings()
  return settings.orderTicketTemplate
}

export async function getSelectedOrderPrinterName() {
  const printer = await getSelectedOrderPrinter()
  return printer?.systemName?.trim() || null
}

export async function testPrinter(printerNameFromRequest?: string) {
  let printerName: string | null | undefined = printerNameFromRequest?.trim()

  if (!printerName) {
    printerName = await getSelectedOrderPrinterName()
  }

  if (!printerName) {
    throw new Error('PRINTER_NOT_CONFIGURED')
  }

  const content = [
    '*** ORDR ***',
    'TESTE DE IMPRESSAO',
    new Date().toLocaleString('pt-BR'),
    '',
    '',
    '',
  ].join('\n')

  await printRawThermalText(content, {
    printerName,
    feedLines: 6,
    cut: true,
  })

  return { ok: true }
}