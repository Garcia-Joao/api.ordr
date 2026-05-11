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
    isDefaultReceipt: Boolean(port.isDefaultReceipt),
    isSystem: Boolean(port.isSystem),
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

export async function ensureDefaultReceiptPrintPort(companyId: string) {
  const existing = await prisma.printPort.findFirst({
    where: { companyId, isDefaultReceipt: true },
    include: portInclude,
  })

  if (existing) return normalizePort(existing)

  const port = await prisma.printPort.create({
    data: {
      companyId,
      name: 'Caixa / Recibos',
      description: 'Port fixa para recibos do caixa e listas de compras.',
      active: true,
      sortOrder: -100,
      isDefaultReceipt: true,
      isSystem: true,
    },
    include: portInclude,
  })

  return normalizePort(port)
}

export async function getDefaultReceiptPrintPort(companyId: string) {
  await ensureDefaultReceiptPrintPort(companyId)
  return prisma.printPort.findFirst({
    where: { companyId, isDefaultReceipt: true, active: true },
    include: { bindings: { include: { terminalDevice: true } } },
  })
}

export async function listPrintPorts(companyId: string) {
  await ensureDefaultReceiptPrintPort(companyId)

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

  if (existing.isDefaultReceipt || existing.isSystem) {
    throw new Error('PRINT_PORT_SYSTEM_LOCKED')
  }

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

type PrintTemplateKind = 'ORDER_TICKET' | 'BUY_LIST'

export type PrintTemplateConfig = {
  enabledFields: Record<string, boolean>
  headerText: string
  footerText: string
}

const defaultOrderTicketTemplate: PrintTemplateConfig = {
  enabledFields: {
    logo: true,
    portName: true,
    orderId: true,
    comanda: true,
    comandaName: true,
    observation: true,
    items: true,
    variations: true,
    notes: true,
    date: true,
  },
  headerText: '*** ORDR ***',
  footerText: '',
}

const defaultBuyListTemplate: PrintTemplateConfig = {
  enabledFields: {
    requestTitle: true,
    requestId: true,
    supplierName: true,
    eventName: true,
    notes: true,
    date: true,
    checklistBoxes: true,
    categories: true,
    itemNotes: true,
  },
  headerText: '*** LISTA DE COMPRAS ***',
  footerText: '',
}

const legacyOrderTemplate = {
  showLogo: true,
  showOrderId: true,
  showDate: true,
  showComandaName: true,
  showVariations: true,
  showNotes: true,
  headerText: '*** ORDR ***',
  footerText: '',
}

function getDefaultTemplate(kind: PrintTemplateKind): PrintTemplateConfig {
  return kind === 'BUY_LIST' ? defaultBuyListTemplate : defaultOrderTicketTemplate
}

function sanitizeTemplateConfig(kind: PrintTemplateKind, input: any): PrintTemplateConfig {
  const defaults = getDefaultTemplate(kind)
  const enabledFields = { ...defaults.enabledFields }

  if (input?.enabledFields && typeof input.enabledFields === 'object') {
    for (const key of Object.keys(enabledFields)) {
      if (input.enabledFields[key] !== undefined) {
        enabledFields[key] = Boolean(input.enabledFields[key])
      }
    }
  }

  return {
    enabledFields,
    headerText: cleanText(input?.headerText) ?? defaults.headerText,
    footerText: cleanText(input?.footerText) ?? '',
  }
}

function normalizeTemplateRecord(kind: PrintTemplateKind, record: any) {
  return {
    kind,
    config: sanitizeTemplateConfig(kind, record?.config),
    updatedAt: record?.updatedAt?.toISOString?.() ?? record?.updatedAt ?? null,
  }
}

export async function getPrintTemplate(companyId: string, kind: PrintTemplateKind) {
  const record = await prisma.printTemplate.findUnique({
    where: { companyId_kind: { companyId, kind } },
  })

  return normalizeTemplateRecord(kind, record)
}

export async function getPrintTemplates(companyId: string) {
  const templates = await prisma.printTemplate.findMany({ where: { companyId } })
  const byKind = new Map(templates.map((template) => [template.kind, template]))

  return {
    orderTicket: normalizeTemplateRecord('ORDER_TICKET', byKind.get('ORDER_TICKET')),
    buyList: normalizeTemplateRecord('BUY_LIST', byKind.get('BUY_LIST')),
  }
}

export async function savePrintTemplate(companyId: string, kind: PrintTemplateKind, config: any) {
  const sanitized = sanitizeTemplateConfig(kind, config)

  const template = await prisma.printTemplate.upsert({
    where: { companyId_kind: { companyId, kind } },
    create: { companyId, kind, config: sanitized as any },
    update: { config: sanitized as any },
  })

  return normalizeTemplateRecord(kind, template)
}

export async function savePrintTemplates(companyId: string, input: any) {
  const [orderTicket, buyList] = await Promise.all([
    input?.orderTicket ? savePrintTemplate(companyId, 'ORDER_TICKET', input.orderTicket.config ?? input.orderTicket) : getPrintTemplate(companyId, 'ORDER_TICKET'),
    input?.buyList ? savePrintTemplate(companyId, 'BUY_LIST', input.buyList.config ?? input.buyList) : getPrintTemplate(companyId, 'BUY_LIST'),
  ])

  return { orderTicket, buyList }
}

export async function getPrinterSettings(companyId?: string) {
  if (!companyId) {
    return {
      ports: [],
      terminals: [],
      printers: [],
      orderPrinterId: null,
      orderTicketTemplate: legacyOrderTemplate,
      printTemplates: {
        orderTicket: normalizeTemplateRecord('ORDER_TICKET', null),
        buyList: normalizeTemplateRecord('BUY_LIST', null),
      },
    }
  }

  const [ports, terminals, printTemplates] = await Promise.all([
    listPrintPorts(companyId),
    getPrintTerminals(companyId),
    getPrintTemplates(companyId),
  ])

  return {
    ports,
    terminals,
    printers: [],
    orderPrinterId: null,
    orderTicketTemplate: legacyOrderTemplate,
    printTemplates,
  }
}

export async function savePrinterSettings(companyId: string | undefined, input: any) {
  if (!companyId) throw new Error('COMPANY_REQUIRED')

  const printTemplates = await savePrintTemplates(companyId, input?.printTemplates ?? input)

  return {
    ...(await getPrinterSettings(companyId)),
    printTemplates,
  }
}

export async function getOrderTicketTemplate(companyId?: string) {
  if (!companyId) return legacyOrderTemplate
  const template = await getPrintTemplate(companyId, 'ORDER_TICKET')
  const config = template.config

  return {
    showLogo: config.enabledFields.logo,
    showOrderId: config.enabledFields.orderId,
    showDate: config.enabledFields.date,
    showComandaName: config.enabledFields.comandaName,
    showVariations: config.enabledFields.variations,
    showNotes: config.enabledFields.notes,
    headerText: config.headerText,
    footerText: config.footerText,
  }
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

export async function getSelectedOrderPrinterName() {
  return null
}
