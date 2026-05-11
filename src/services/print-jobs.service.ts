import { prisma } from '../lib/prisma'
import { getPrintTemplates } from './printers.service'

const ONLINE_THRESHOLD_MS = 45 * 1000

type PrintJobStatus = 'PENDING' | 'CLAIMED' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED'

type CreatePrintJobInput = {
  companyId: string
  orderId?: string | null
  portId?: string | null
  type?: 'ORDER_TICKET' | 'BUY_LIST' | 'TEST'
  payload: unknown
}

function isTerminalOnline(device: any) {
  if (!device?.lastSeenAt) return false
  return Date.now() - new Date(device.lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS
}

function normalizeJob(job: any) {
  return {
    id: job.id,
    companyId: job.companyId,
    orderId: job.orderId,
    portId: job.portId,
    terminalDeviceId: job.terminalDeviceId,
    type: job.type,
    status: job.status,
    payload: job.payload,
    attempts: job.attempts,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt?.toISOString?.() ?? job.createdAt,
    claimedAt: job.claimedAt?.toISOString?.() ?? job.claimedAt,
    printedAt: job.printedAt?.toISOString?.() ?? job.printedAt,
    failedAt: job.failedAt?.toISOString?.() ?? job.failedAt,
    port: job.port
      ? {
          id: job.port.id,
          name: job.port.name,
          localPrinterName: job.port.localPrinterName,
          localPrinterLabel: job.port.localPrinterLabel,
          paperWidth: job.port.paperWidth,
          terminalDeviceId: job.port.terminalDeviceId,
          bindings: (job.port.bindings ?? []).map((binding: any) => ({
            id: binding.id,
            portId: binding.portId,
            terminalDeviceId: binding.terminalDeviceId,
            localPrinterName: binding.localPrinterName,
            localPrinterLabel: binding.localPrinterLabel ?? binding.localPrinterName,
          })),
        }
      : null,
    order: job.order ? { id: job.order.id, comanda: job.order.comanda, comandaName: job.order.comandaName } : null,
  }
}

async function getPortForJob(companyId: string, portId?: string | null) {
  if (!portId) return null

  const port = await prisma.printPort.findFirst({
    where: { id: portId, companyId, active: true },
    include: { terminalDevice: true, bindings: { include: { terminalDevice: true } } },
  })

  if (!port) throw new Error('PRINT_PORT_NOT_FOUND')
  const hasAvailableBinding = (port.bindings ?? []).some((binding: any) =>
    binding.terminalDevice?.printTerminalEnabled &&
    binding.terminalDevice?.clientType === 'ELECTRON' &&
    isTerminalOnline(binding.terminalDevice)
  )

  if (!hasAvailableBinding) throw new Error('PRINT_PORT_NOT_BOUND')

  return port
}

export async function createPrintJob(input: CreatePrintJobInput) {
  const port = await getPortForJob(input.companyId, input.portId)

  const job = await prisma.printJob.create({
    data: {
      companyId: input.companyId,
      orderId: input.orderId || null,
      portId: port?.id ?? input.portId ?? null,
      terminalDeviceId: (port?.bindings ?? [])[0]?.terminalDeviceId ?? port?.terminalDeviceId ?? null,
      type: input.type ?? 'ORDER_TICKET',
      payload: input.payload as any,
    },
    include: { port: { include: { bindings: true } }, order: true },
  })

  return normalizeJob(job)
}

type PrintItemMode = 'SEPARATE' | 'GROUPED'

type CreateOrderPrintJobsOptions = {
  itemPrintModes?: Map<string, PrintItemMode>
}

function getOrderItemPrintKey(item: any) {
  const optionIds = (item.variations ?? [])
    .flatMap((selection: any) =>
      (selection.options ?? []).map((selected: any) => selected.optionId)
    )
    .filter(Boolean)
    .sort()

  return `${item.productId}-${JSON.stringify(optionIds)}`
}

function normalizeOrderItemForPayload(item: any, quantityOverride?: number) {
  const quantity = quantityOverride ?? Number(item.quantity ?? 1)
  const unitPrice = Number(item.unitPrice ?? 0)

  return {
    name: item.product?.name ?? 'Item',
    quantity,
    unitPrice,
    totalPrice: Number((unitPrice * quantity).toFixed(2)),
    notes: item.notes ?? null,
    productId: item.productId,
    categoryName: item.product?.category?.name ?? null,
    variations: (item.variations ?? []).flatMap((selection: any) =>
      (selection.options ?? []).map((option: any) => option.option?.name).filter(Boolean)
    ),
  }
}

function buildSeparateTicketsForItem(item: any) {
  const quantity = Number(item.quantity ?? 1)
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1

  return Array.from({ length: Math.max(1, safeQuantity) }, () => ({
    mode: 'SEPARATE' as const,
    items: [normalizeOrderItemForPayload(item, 1)],
  }))
}

function buildTicketsForPortItems(itemsWithModes: Array<{ item: any; mode: PrintItemMode }>) {
  const tickets: any[] = []
  const groupedItems: any[] = []

  for (const { item, mode } of itemsWithModes) {
    if (mode === 'GROUPED') {
      groupedItems.push(normalizeOrderItemForPayload(item))
      continue
    }

    tickets.push(...buildSeparateTicketsForItem(item))
  }

  if (groupedItems.length > 0) {
    tickets.unshift({
      mode: 'GROUPED' as const,
      items: groupedItems,
    })
  }

  return tickets
}

function buildOrderPayload(order: any, port: any, tickets: any[], template?: any) {
  const flattenedItems = tickets.flatMap((ticket) => ticket.items ?? [])

  return {
    kind: 'ORDER_TICKET',
    title: 'Pedido',
    orderId: order.id,
    comanda: order.comanda,
    comandaName: order.comandaName ?? null,
    observation: order.observation ?? null,
    createdAt: order.createdAt,
    port: port ? { id: port.id, name: port.name } : null,
    tickets,
    items: flattenedItems,
    template: template?.orderTicket?.config ?? null,
  }
}

export async function createOrderPrintJobs(
  companyId: string,
  orderId: string,
  options: CreateOrderPrintJobsOptions = {}
) {
  const printTemplates = await getPrintTemplates(companyId)

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: {
      items: {
        include: {
          product: { include: { category: true, printPort: true } },
          variations: { include: { options: { include: { option: true } } } },
        },
      },
    },
  })

  if (!order) throw new Error('ORDER_NOT_FOUND')

  const defaultPort = await prisma.printPort.findFirst({
    where: { companyId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { bindings: { include: { terminalDevice: true } } },
  })

  const portIds = new Set<string>()
  const itemsByPort = new Map<string, Array<{ item: any; mode: PrintItemMode }>>()

  for (const item of order.items) {
    const productPortId = item.product?.printPortId ?? null
    const categoryPortId = item.product?.category?.printPortId ?? null
    const resolvedPortId = productPortId || categoryPortId || defaultPort?.id || 'unassigned'
    const itemKey = getOrderItemPrintKey(item)
    const mode = options.itemPrintModes?.get(itemKey) ?? 'SEPARATE'

    portIds.add(resolvedPortId)
    itemsByPort.set(resolvedPortId, [
      ...(itemsByPort.get(resolvedPortId) ?? []),
      { item, mode },
    ])
  }

  const ports = await prisma.printPort.findMany({
    where: { id: { in: Array.from(portIds).filter((id) => id !== 'unassigned') }, companyId, active: true },
    include: { bindings: { include: { terminalDevice: true } } },
  })

  const portsById = new Map(ports.map((port) => [port.id, port]))
  const jobs = []

  for (const [portId, itemsWithModes] of itemsByPort.entries()) {
    const port = portsById.get(portId) ?? null
    const tickets = buildTicketsForPortItems(itemsWithModes)
    const bindings = (port?.bindings ?? []).filter((binding: any) =>
      binding.terminalDevice?.printTerminalEnabled &&
      binding.terminalDevice?.clientType === 'ELECTRON' &&
      isTerminalOnline(binding.terminalDevice)
    )

    if (!port || bindings.length === 0) {
      jobs.push(await prisma.printJob.create({
        data: {
          companyId,
          orderId: order.id,
          portId: port?.id ?? null,
          terminalDeviceId: null,
          status: 'FAILED',
          errorMessage: port ? 'PRINT_PORT_NOT_BOUND' : 'PRINT_PORT_NOT_FOUND',
          payload: buildOrderPayload(order, port, tickets, printTemplates) as any,
        },
        include: { port: { include: { bindings: true } }, order: true },
      }))
      continue
    }

    const uniqueTerminalIds = Array.from(new Set(bindings.map((binding: any) => binding.terminalDeviceId)))

    for (const terminalDeviceId of uniqueTerminalIds) {
      jobs.push(await prisma.printJob.create({
        data: {
          companyId,
          orderId: order.id,
          portId: port.id,
          terminalDeviceId,
          status: 'PENDING',
          errorMessage: null,
          payload: buildOrderPayload(order, port, tickets, printTemplates) as any,
        },
        include: { port: { include: { bindings: true } }, order: true },
      }))
    }
  }

  return jobs.map(normalizeJob)
}


function normalizeUnitLabel(unit?: string | null) {
  if (!unit || unit === 'unit') return ''
  if (unit === 'g') return 'gr'
  return unit
}

function formatChecklistQuantity(value: number | string | null | undefined, unit?: string | null) {
  const formatted = Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })

  const unitLabel = normalizeUnitLabel(unit)
  return unitLabel ? `${formatted}${unitLabel}` : formatted
}

function buildBuyListPayload(request: any, port: any, template?: any) {
  return {
    kind: 'BUY_LIST',
    title: 'Lista de Compras',
    buyRequestId: request.id,
    buyRequestTitle: request.title?.trim() || 'Compra',
    supplierName: request.supplierName?.trim() || null,
    notes: request.notes?.trim() || null,
    eventName: request.eventDate?.title ?? null,
    createdAt: new Date().toISOString(),
    requestCreatedAt: request.createdAt,
    port: port ? { id: port.id, name: port.name } : null,
    template: template?.buyList?.config ?? null,
    items: (request.items ?? []).map((item: any) => ({
      name: item.product?.name ?? 'Item',
      productId: item.productId,
      quantity: Number(item.requestedQuantity ?? 0),
      unit: item.product?.stockUnit ?? 'unit',
      quantityLabel: formatChecklistQuantity(
        Number(item.requestedQuantity ?? 0),
        item.product?.stockUnit ?? 'unit'
      ),
      categoryName: item.product?.category?.name ?? null,
      notes: item.notes ?? null,
      checklist: true,
    })),
  }
}

export async function createBuyRequestShoppingListPrintJobs(input: {
  companyId: string
  buyRequestId: string
  portId?: string | null
}) {
  const printTemplates = await getPrintTemplates(input.companyId)

  const request = await prisma.buyRequest.findFirst({
    where: {
      id: input.buyRequestId,
      companyId: input.companyId,
    },
    include: {
      eventDate: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  if (!request) throw new Error('BUY_REQUEST_NOT_FOUND')

  const port = input.portId
    ? await prisma.printPort.findFirst({
        where: {
          id: input.portId,
          companyId: input.companyId,
          active: true,
        },
        include: {
          bindings: {
            include: {
              terminalDevice: true,
            },
          },
        },
      })
    : await prisma.printPort.findFirst({
        where: {
          companyId: input.companyId,
          active: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          bindings: {
            include: {
              terminalDevice: true,
            },
          },
        },
      })

  if (!port) {
    const failedJob = await prisma.printJob.create({
      data: {
        companyId: input.companyId,
        orderId: null,
        portId: null,
        terminalDeviceId: null,
        type: 'BUY_LIST',
        status: 'FAILED',
        errorMessage: 'PRINT_PORT_NOT_FOUND',
        payload: buildBuyListPayload(request, null, printTemplates) as any,
      },
      include: { port: { include: { bindings: true } }, order: true },
    })

    return [normalizeJob(failedJob)]
  }

  const bindings = (port.bindings ?? []).filter((binding: any) =>
    binding.terminalDevice?.printTerminalEnabled &&
    binding.terminalDevice?.clientType === 'ELECTRON' &&
    isTerminalOnline(binding.terminalDevice)
  )

  if (bindings.length === 0) {
    const failedJob = await prisma.printJob.create({
      data: {
        companyId: input.companyId,
        orderId: null,
        portId: port.id,
        terminalDeviceId: null,
        type: 'BUY_LIST',
        status: 'FAILED',
        errorMessage: 'PRINT_PORT_NOT_BOUND',
        payload: buildBuyListPayload(request, port, printTemplates) as any,
      },
      include: { port: { include: { bindings: true } }, order: true },
    })

    return [normalizeJob(failedJob)]
  }

  const uniqueTerminalIds = Array.from(
    new Set(bindings.map((binding: any) => binding.terminalDeviceId))
  )

  const jobs = []

  for (const terminalDeviceId of uniqueTerminalIds) {
    jobs.push(await prisma.printJob.create({
      data: {
        companyId: input.companyId,
        orderId: null,
        portId: port.id,
        terminalDeviceId,
        type: 'BUY_LIST',
        status: 'PENDING',
        errorMessage: null,
        payload: buildBuyListPayload(request, port, printTemplates) as any,
      },
      include: { port: { include: { bindings: true } }, order: true },
    }))
  }

  return jobs.map(normalizeJob)
}

export async function listTerminalPendingJobs(companyId: string, terminalDeviceId: string) {
  const terminal = await prisma.device.findFirst({
    where: {
      id: terminalDeviceId,
      companyId,
      clientType: 'ELECTRON',
      isPrintTerminal: true,
      printTerminalEnabled: true,
    },
    select: { id: true },
  })

  if (!terminal) throw new Error('PRINT_TERMINAL_NOT_FOUND')

  const jobs = await prisma.printJob.findMany({
    where: {
      companyId,
      terminalDeviceId,
      status: { in: ['PENDING', 'CLAIMED'] },
    },
    include: { port: { include: { bindings: true } }, order: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  return jobs.map(normalizeJob)
}

export async function claimPrintJob(companyId: string, terminalDeviceId: string, jobId: string) {
  const job = await prisma.printJob.findFirst({
    where: { id: jobId, companyId, terminalDeviceId, status: 'PENDING' },
  })

  if (!job) throw new Error('PRINT_JOB_NOT_FOUND')

  const updated = await prisma.printJob.update({
    where: { id: jobId },
    data: { status: 'CLAIMED', claimedAt: new Date(), attempts: { increment: 1 } },
    include: { port: { include: { bindings: true } }, order: true },
  })

  return normalizeJob(updated)
}

export async function updatePrintJobStatus(companyId: string, terminalDeviceId: string, jobId: string, status: PrintJobStatus, errorMessage?: string | null) {
  const job = await prisma.printJob.findFirst({ where: { id: jobId, companyId, terminalDeviceId } })
  if (!job) throw new Error('PRINT_JOB_NOT_FOUND')

  if (status === 'PRINTED') {
    const deleted = await prisma.printJob.delete({
      where: { id: jobId },
      include: { port: { include: { bindings: true } }, order: true },
    })

    return normalizeJob({ ...deleted, status: 'PRINTED', printedAt: new Date() })
  }

  const now = new Date()
  const updated = await prisma.printJob.update({
    where: { id: jobId },
    data: {
      status,
      errorMessage: errorMessage ?? null,
      ...(status === 'PRINTING' ? { startedAt: now } : {}),
      ...(status === 'FAILED' ? { failedAt: now } : {}),
    },
    include: { port: { include: { bindings: true } }, order: true },
  })

  return normalizeJob(updated)
}

export async function deletePrintJob(companyId: string, terminalDeviceId: string, jobId: string) {
  const job = await prisma.printJob.findFirst({
    where: {
      id: jobId,
      companyId,
      terminalDeviceId,
      status: { in: ['PENDING', 'CLAIMED', 'FAILED', 'CANCELLED'] },
    },
    include: { port: { include: { bindings: true } }, order: true },
  })

  if (!job) throw new Error('PRINT_JOB_NOT_FOUND')

  await prisma.printJob.delete({ where: { id: jobId } })

  return normalizeJob({ ...job, status: 'CANCELLED' })
}
