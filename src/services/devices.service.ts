import { prisma } from '../lib/prisma'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

type DeviceType = 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN'
type DeviceClientType = 'WEB' | 'ELECTRON'

type HeartbeatInput = {
  companyId: string
  userId: string
  deviceId?: string | null
  name?: string | null
  type?: string | null
  browser?: string | null
  os?: string | null
  userAgent?: string | null
  ipAddress?: string | null
  clientType?: string | null
  isPrintTerminal?: boolean | null
  printTerminalEnabled?: boolean | null
  localPrinters?: unknown
}

function normalizeDeviceType(value?: string | null): DeviceType {
  const normalized = String(value ?? '').toUpperCase()

  if (normalized === 'DESKTOP') return 'DESKTOP'
  if (normalized === 'MOBILE') return 'MOBILE'
  if (normalized === 'TABLET') return 'TABLET'

  return 'UNKNOWN'
}

function normalizeClientType(value?: string | null): DeviceClientType {
  return String(value ?? '').toUpperCase() === 'ELECTRON' ? 'ELECTRON' : 'WEB'
}

function cleanText(value?: string | null, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function getStartOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function getDeviceStatus(lastSeenAt: Date) {
  return Date.now() - lastSeenAt.getTime() <= ONLINE_THRESHOLD_MS
    ? 'online'
    : 'offline'
}

export async function heartbeatDevice(input: HeartbeatInput) {
  const now = new Date()
  const id = cleanText(input.deviceId, '')
  const baseData = {
    companyId: input.companyId,
    currentUserId: input.userId,
    name: cleanText(input.name, 'Dispositivo sem nome'),
    type: normalizeDeviceType(input.type),
    browser: cleanText(input.browser, '') || null,
    os: cleanText(input.os, '') || null,
    userAgent: cleanText(input.userAgent, '') || null,
    ipAddress: cleanText(input.ipAddress, '') || null,
    clientType: normalizeClientType(input.clientType),
    isPrintTerminal: Boolean(input.isPrintTerminal) && normalizeClientType(input.clientType) === 'ELECTRON',
    printTerminalEnabled: Boolean(input.printTerminalEnabled) && normalizeClientType(input.clientType) === 'ELECTRON',
    terminalApprovedAt: Boolean(input.printTerminalEnabled) && normalizeClientType(input.clientType) === 'ELECTRON' ? now : null,
    localPrinters: Array.isArray(input.localPrinters) ? (input.localPrinters as any) : undefined,
    lastSeenAt: now,
  } as any

  const device = id
    ? await prisma.device.upsert({
        where: { id },
        create: {
          id,
          ...baseData,
          firstSeenAt: now,
        },
        update: baseData,
        include: { currentUser: { select: { id: true, username: true, name: true } } },
      })
    : await prisma.device.create({
        data: {
          ...baseData,
          firstSeenAt: now,
        },
        include: { currentUser: { select: { id: true, username: true, name: true } } },
      })

  return {
    id: device.id,
    name: device.name,
    type: device.type,
    status: getDeviceStatus(device.lastSeenAt),
    lastSeenAt: device.lastSeenAt.toISOString(),
    currentUser: device.currentUser,
    clientType: (device as any).clientType ?? 'WEB',
    isPrintTerminal: Boolean((device as any).isPrintTerminal),
    printTerminalEnabled: Boolean((device as any).printTerminalEnabled),
    localPrinters: (device as any).localPrinters ?? [],
  }
}

export async function listCompanyDevices(companyId: string) {
  const devices = await prisma.device.findMany({
    where: { companyId },
    orderBy: [
      { lastSeenAt: 'desc' },
      { name: 'asc' },
    ],
    include: {
      currentUser: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  })

  const today = getStartOfToday()
  const sales = await prisma.order.groupBy({
    by: ['deviceId'],
    where: {
      companyId,
      deviceId: { not: null },
      status: 'paid',
      createdAt: { gte: today },
    },
    _count: { _all: true },
    _sum: { total: true },
  })

  const salesByDevice = new Map(
    sales.map((item) => [
      item.deviceId,
      {
        salesCount: item._count._all,
        totalSales: Number(item._sum.total ?? 0),
      },
    ])
  )

  return devices.map((device) => {
    const deviceSales = salesByDevice.get(device.id) ?? {
      salesCount: 0,
      totalSales: 0,
    }

    return {
      id: device.id,
      name: device.name,
      type: device.type,
      browser: device.browser,
      os: device.os,
      userAgent: device.userAgent,
      ipAddress: device.ipAddress,
      firstSeenAt: device.firstSeenAt.toISOString(),
      lastSeenAt: device.lastSeenAt.toISOString(),
      status: getDeviceStatus(device.lastSeenAt),
      currentUser: device.currentUser,
      clientType: (device as any).clientType ?? 'WEB',
      isPrintTerminal: Boolean((device as any).isPrintTerminal),
      printTerminalEnabled: Boolean((device as any).printTerminalEnabled),
      terminalApprovedAt: (device as any).terminalApprovedAt?.toISOString?.() ?? null,
      localPrinters: (device as any).localPrinters ?? [],
      salesCount: deviceSales.salesCount,
      totalSales: deviceSales.totalSales,
    }
  })
}

export async function deleteCompanyDevice(params: {
  companyId: string
  userId: string
  deviceId: string
}) {
  const membership = await prisma.userCompany.findUnique({
    where: {
      userId_companyId: {
        userId: params.userId,
        companyId: params.companyId,
      },
    },
    select: { systemRole: true },
  })

  if (!membership) {
    throw new Error('COMPANY_ACCESS_DENIED')
  }

  if (membership.systemRole !== 'ADMIN') {
    throw new Error('ADMIN_ACCESS_REQUIRED')
  }

  const device = await prisma.device.findFirst({
    where: {
      id: params.deviceId,
      companyId: params.companyId,
    },
    select: { id: true },
  })

  if (!device) {
    throw new Error('DEVICE_NOT_FOUND')
  }

  await prisma.device.delete({ where: { id: device.id } })

  return { ok: true }
}
