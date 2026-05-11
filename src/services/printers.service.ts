import { prisma } from '../lib/prisma'

const ONLINE_THRESHOLD_MS = 45 * 1000

const {
  listGenericTextPrinters,
  printRawThermalText,
} = require('../../printer.js')

export type PrintPortInput = {
  name?: string | null
  description?: string | null
  active?: boolean
  sortOrder?: number | null
  terminalDeviceId?: string | null
  localPrinterName?: string | null
  localPrinterLabel?: string | null
  paperWidth?: number | null
}

export type PrintPortBindingsInput = {
  terminalDeviceId?: string | null
  printers?: Array<{
    localPrinterName?: string | null
    localPrinterLabel?: string | null
  }>
}

function cleanText(value?: string | null) {
  const text = String(value ?? '').trim()
  return text || null
}

function isOnline(value?: Date | null) {
  if (!value) return false
  return Date.now() - value.getTime() <= ONLINE_THRESHOLD_MS
}

function normalizeTerminal(device: any) {
  return {
    id: device.id,
    name: device.name,
    type: device.type,
    clientType: device.clientType,
    isPrintTerminal: device.isPrintTerminal,
    printTerminalEnabled: device.printTerminalEnabled,
    terminalApprovedAt: device.terminalApprovedAt?.toISOString?.() ?? null,
    localPrinters: device.localPrinters ?? [],
    browser: device.browser,
    os: device.os,
    ipAddress: device.ipAddress,
    lastSeenAt: device.lastSeenAt?.toISOString?.() ?? device.lastSeenAt,
    status: isOnline(device.lastSeenAt) ? 'online' : 'offline',
    currentUser: device.currentUser ?? null,
  }
}

function normalizeBinding(binding: any) {
  return {
    id: binding.id,
    portId: binding.portId,
    terminalDeviceId: binding.terminalDeviceId,
    localPrinterName: binding.localPrinterName,
    localPrinterLabel: binding.localPrinterLabel ?? binding.localPrinterName,
    createdAt: binding.createdAt?.toISOString?.() ?? binding.createdAt,
    updatedAt: binding.updatedAt?.toISOString?.() ?? binding.updatedAt,
    terminalDevice: binding.terminalDevice ? normalizeTerminal(binding.terminalDevice) : null,
  }
}

function normalizePort(port: any) {
  return {
    id: port.id,
    companyId: port.companyId,
    name: port.name,
    description: port.description ?? null,
    active: Boolean(port.active),
    sortOrder: Number(port.sortOrder ?? 0),
    // Legacy single-printer fields kept for backwards compatibility.
    terminalDeviceId: port.terminalDeviceId ?? null,
    localPrinterName: port.localPrinterName ?? null,
    localPrinterLabel: port.localPrinterLabel ?? null,
    paperWidth: port.paperWidth ?? null,
    bindings: (port.bindings ?? []).map(normalizeBinding),
    createdAt: port.createdAt?.toISOString?.() ?? port.createdAt,
    updatedAt: port.updatedAt?.toISOString?.() ?? port.updatedAt,
    terminalDevice: port.terminalDevice ? normalizeTerminal(port.terminalDevice) : null,
  }
}

const portInclude = {
  terminalDevice: {
    include: {
      currentUser: { select: { id: true, username: true, name: true } },
    },
  },
  bindings: {
    include: {
      terminalDevice: {
        include: {
          currentUser: { select: { id: true, username: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
}

async function assertPortDevice(companyId: string, terminalDeviceId?: string | null) {
  if (!terminalDeviceId) return null

  const device = await prisma.device.findFirst({
    where: {
      id: terminalDeviceId,
      companyId,
      clientType: 'ELECTRON',
      isPrintTerminal: true,
      printTerminalEnabled: true,
    },
    select: { id: true },
  })

  if (!device) throw new Error('PRINT_TERMINAL_NOT_FOUND')

  return device.id
}

export async function getSystemPrinters() {
  return await listGenericTextPrinters()
}

export async function getPrintTerminals(companyId: string) {
  const devices = await prisma.device.findMany({
    where: {
      companyId,
      clientType: 'ELECTRON',
      isPrintTerminal: true,
    },
    include: {
      currentUser: { select: { id: true, username: true, name: true } },
    },
    orderBy: [{ lastSeenAt: 'desc' }, { name: 'asc' }],
  })

  return devices.map(normalizeTerminal)
}

export async function listPrintPorts(companyId: string) {
  const ports = await prisma.printPort.findMany({
    where: { companyId },
    include: portInclude,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return ports.map(normalizePort)
}

export async function createPrintPort(companyId: string, input: PrintPortInput) {
  const name = cleanText(input.name)
  if (!name) throw new Error('PRINT_PORT_NAME_REQUIRED')

  const port = await prisma.printPort.create({
    data: {
      companyId,
      name,
      description: cleanText(input.description),
      active: input.active ?? true,
      sortOrder: Number(input.sortOrder ?? 0),
    },
    include: portInclude,
  })

  return normalizePort(port)
}

export async function updatePrintPort(companyId: string, portId: string, input: PrintPortInput) {
  const existing = await prisma.printPort.findFirst({ where: { id: portId, companyId } })
  if (!existing) throw new Error('PRINT_PORT_NOT_FOUND')

  const port = await prisma.printPort.update({
    where: { id: portId },
    data: {
      ...(input.name !== undefined ? { name: cleanText(input.name) ?? existing.name } : {}),
      ...(input.description !== undefined ? { description: cleanText(input.description) } : {}),
      ...(input.active !== undefined ? { active: Boolean(input.active) } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: Number(input.sortOrder ?? 0) } : {}),
    },
    include: portInclude,
  })

  return normalizePort(port)
}

export async function deletePrintPort(companyId: string, portId: string) {
  const existing = await prisma.printPort.findFirst({ where: { id: portId, companyId } })
  if (!existing) throw new Error('PRINT_PORT_NOT_FOUND')

  await prisma.printPort.delete({ where: { id: portId } })
  return { ok: true }
}

// Legacy single-printer binding endpoint kept so older builds do not break.
export async function bindPrintPort(companyId: string, portId: string, input: PrintPortInput) {
  const terminalDeviceId = await assertPortDevice(companyId, input.terminalDeviceId)
  const port = await prisma.printPort.findFirst({ where: { id: portId, companyId } })
  if (!port) throw new Error('PRINT_PORT_NOT_FOUND')

  await prisma.printPort.update({
    where: { id: portId },
    data: {
      terminalDeviceId,
      localPrinterName: cleanText(input.localPrinterName),
      localPrinterLabel: cleanText(input.localPrinterLabel),
      paperWidth: input.paperWidth ? Number(input.paperWidth) : null,
    },
  })

  if (terminalDeviceId && input.localPrinterName) {
    return setPrintPortBindings(companyId, portId, {
      terminalDeviceId,
      printers: [{
        localPrinterName: input.localPrinterName,
        localPrinterLabel: input.localPrinterLabel ?? input.localPrinterName,
      }],
    })
  }

  const updated = await prisma.printPort.findUnique({ where: { id: portId }, include: portInclude })
  return normalizePort(updated)
}

export async function setPrintPortBindings(companyId: string, portId: string, input: PrintPortBindingsInput) {
  const terminalDeviceId = await assertPortDevice(companyId, input.terminalDeviceId)
  if (!terminalDeviceId) throw new Error('PRINT_TERMINAL_NOT_FOUND')

  const port = await prisma.printPort.findFirst({ where: { id: portId, companyId } })
  if (!port) throw new Error('PRINT_PORT_NOT_FOUND')

  const printers = (input.printers ?? [])
    .map((printer) => ({
      localPrinterName: cleanText(printer.localPrinterName),
      localPrinterLabel: cleanText(printer.localPrinterLabel) ?? cleanText(printer.localPrinterName),
    }))
    .filter((printer): printer is { localPrinterName: string; localPrinterLabel: string | null } => Boolean(printer.localPrinterName))

  await prisma.$transaction([
    prisma.printPortBinding.deleteMany({ where: { portId, terminalDeviceId } }),
    ...(printers.length > 0
      ? [prisma.printPortBinding.createMany({
          data: printers.map((printer) => ({
            companyId,
            portId,
            terminalDeviceId,
            localPrinterName: printer.localPrinterName,
            localPrinterLabel: printer.localPrinterLabel,
          })),
          skipDuplicates: true,
        })]
      : []),
  ])

  const updated = await prisma.printPort.findUnique({ where: { id: portId }, include: portInclude })
  return normalizePort(updated)
}

export async function getPrinterSettings(companyId?: string) {
  if (!companyId) {
    return {
      ports: [],
      terminals: [],
      printers: [],
      orderPrinterId: null,
      orderTicketTemplate: defaultTemplate,
    }
  }

  const [ports, terminals] = await Promise.all([
    listPrintPorts(companyId),
    getPrintTerminals(companyId),
  ])

  return {
    ports,
    terminals,
    printers: [],
    orderPrinterId: null,
    orderTicketTemplate: defaultTemplate,
  }
}

export async function savePrinterSettings(input: any) {
  return input
}

const defaultTemplate = {
  showLogo: true,
  showOrderId: true,
  showDate: true,
  showComandaName: true,
  showVariations: true,
  showNotes: true,
  headerText: '*** ORDR ***',
  footerText: '',
}

export async function testPrinter(printerNameFromRequest?: string) {
  const printerName = printerNameFromRequest?.trim()
  if (!printerName) throw new Error('PRINTER_NOT_CONFIGURED')

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

export async function getSelectedOrderPrinter() {
  return null
}

export async function getOrderTicketTemplate() {
  return defaultTemplate
}

export async function getSelectedOrderPrinterName() {
  return null
}
