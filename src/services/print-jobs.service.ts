import { prisma } from '../lib/prisma'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

type PrintJobStatus = 'PENDING' | 'CLAIMED' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'CANCELLED'

type CreatePrintJobInput = {
  companyId: string
  orderId?: string | null
  portId?: string | null
  type?: 'ORDER_TICKET' | 'TEST'
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
        }
      : null,
    order: job.order ? { id: job.order.id, comanda: job.order.comanda, comandaName: job.order.comandaName } : null,
  }
}

async function getPortForJob(companyId: string, portId?: string | null) {
  if (!portId) return null

  const port = await prisma.printPort.findFirst({
    where: { id: portId, companyId, active: true },
    include: { terminalDevice: true },
  })

  if (!port) throw new Error('PRINT_PORT_NOT_FOUND')
  if (!port.terminalDeviceId || !port.localPrinterName) throw new Error('PRINT_PORT_NOT_BOUND')
  if (!port.terminalDevice?.printTerminalEnabled || port.terminalDevice.clientType !== 'ELECTRON') {
    throw new Error('PRINT_TERMINAL_NOT_AVAILABLE')
  }

  return port
}

export async function createPrintJob(input: CreatePrintJobInput) {
  const port = await getPortForJob(input.companyId, input.portId)

  const job = await prisma.printJob.create({
    data: {
      companyId: input.companyId,
      orderId: input.orderId || null,
      portId: port?.id ?? input.portId ?? null,
      terminalDeviceId: port?.terminalDeviceId ?? null,
      type: input.type ?? 'ORDER_TICKET',
      payload: input.payload as any,
    },
    include: { port: true, order: true },
  })

  return normalizeJob(job)
}

function buildOrderPayload(order: any, port: any, items: any[]) {
  return {
    title: 'Pedido',
    orderId: order.id,
    comanda: order.comanda,
    comandaName: order.comandaName ?? null,
    observation: order.observation ?? null,
    createdAt: order.createdAt,
    port: port ? { id: port.id, name: port.name } : null,
    items: items.map((item: any) => ({
      name: item.product?.name ?? 'Item',
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice ?? 0),
      totalPrice: Number(item.totalPrice ?? 0),
      notes: item.notes ?? null,
      productId: item.productId,
      categoryName: item.product?.category?.name ?? null,
      variations: (item.variations ?? []).flatMap((selection: any) =>
        (selection.options ?? []).map((option: any) => option.option?.name).filter(Boolean)
      ),
    })),
  }
}

export async function createOrderPrintJobs(companyId: string, orderId: string) {
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
    include: { terminalDevice: true },
  })

  const portIds = new Set<string>()
  const itemsByPort = new Map<string, any[]>()

  for (const item of order.items) {
    const productPortId = item.product?.printPortId ?? null
    const categoryPortId = item.product?.category?.printPortId ?? null
    const resolvedPortId = productPortId || categoryPortId || defaultPort?.id || 'unassigned'
    portIds.add(resolvedPortId)
    itemsByPort.set(resolvedPortId, [...(itemsByPort.get(resolvedPortId) ?? []), item])
  }

  const ports = await prisma.printPort.findMany({
    where: { id: { in: Array.from(portIds).filter((id) => id !== 'unassigned') }, companyId, active: true },
    include: { terminalDevice: true },
  })

  const portsById = new Map(ports.map((port) => [port.id, port]))
  const jobs = []

  for (const [portId, items] of itemsByPort.entries()) {
    const port = portsById.get(portId) ?? null
    if (!port || !port.terminalDeviceId || !port.localPrinterName) {
      jobs.push(await prisma.printJob.create({
        data: {
          companyId,
          orderId: order.id,
          portId: port?.id ?? null,
          terminalDeviceId: null,
          status: 'FAILED',
          errorMessage: port ? 'PRINT_PORT_NOT_BOUND' : 'PRINT_PORT_NOT_FOUND',
          payload: buildOrderPayload(order, port, items) as any,
        },
        include: { port: true, order: true },
      }))
      continue
    }

    jobs.push(await prisma.printJob.create({
      data: {
        companyId,
        orderId: order.id,
        portId: port.id,
        terminalDeviceId: port.terminalDeviceId,
        status: isTerminalOnline(port.terminalDevice) ? 'PENDING' : 'FAILED',
        errorMessage: isTerminalOnline(port.terminalDevice) ? null : 'PRINT_TERMINAL_OFFLINE',
        payload: buildOrderPayload(order, port, items) as any,
      },
      include: { port: true, order: true },
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
    include: { port: true, order: true },
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
    include: { port: true, order: true },
  })

  return normalizeJob(updated)
}

export async function updatePrintJobStatus(companyId: string, terminalDeviceId: string, jobId: string, status: PrintJobStatus, errorMessage?: string | null) {
  const job = await prisma.printJob.findFirst({ where: { id: jobId, companyId, terminalDeviceId } })
  if (!job) throw new Error('PRINT_JOB_NOT_FOUND')

  const now = new Date()
  const updated = await prisma.printJob.update({
    where: { id: jobId },
    data: {
      status,
      errorMessage: errorMessage ?? null,
      ...(status === 'PRINTING' ? { startedAt: now } : {}),
      ...(status === 'PRINTED' ? { printedAt: now } : {}),
      ...(status === 'FAILED' ? { failedAt: now } : {}),
    },
    include: { port: true, order: true },
  })

  return normalizeJob(updated)
}
