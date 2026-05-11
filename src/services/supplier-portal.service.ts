import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type WeekDayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
type StockUnitInput = 'unit' | 'ml' | 'l' | 'g' | 'kg'

export type OperatingHour = {
  day: WeekDayKey
  label: string
  enabled: boolean
  startTime: string
  endTime: string
}

const DAY_LABELS: Record<WeekDayKey, string> = {
  sun: 'Domingo',
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
}

const DAY_KEYS: WeekDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const DEFAULT_OPERATING_HOURS: OperatingHour[] = DAY_KEYS.map((day) => ({
  day,
  label: DAY_LABELS[day],
  enabled: day !== 'sun',
  startTime: day === 'sat' ? '09:00' : '08:00',
  endTime: day === 'sat' ? '13:00' : '18:00',
}))

const SUPPLIER_INCLUDE = {
  priceTables: {
    orderBy: [{ active: 'desc' as const }, { updatedAt: 'desc' as const }],
    include: {
      items: {
        orderBy: { itemName: 'asc' as const },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              emoji: true,
              stockUnit: true,
              category: { select: { id: true, name: true, emoji: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.SupplierInclude

function cleanText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function requiredText(value: unknown, field: string) {
  const cleaned = cleanText(value)
  if (!cleaned) throw new Error(`${field}_REQUIRED`)
  return cleaned
}

function parseMoney(value: unknown, field: string) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(number) || number < 0) throw new Error(`${field}_INVALID`)
  return new Prisma.Decimal(number.toFixed(2))
}

function parseQuantity(value: unknown) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '1').replace(',', '.'))
  if (!Number.isFinite(number) || number <= 0) throw new Error('QUANTITY_INVALID')
  return new Prisma.Decimal(number.toFixed(3))
}

function parseUnit(value: unknown): StockUnitInput {
  const unit = cleanText(value) ?? 'unit'
  if (!['unit', 'ml', 'l', 'g', 'kg'].includes(unit)) throw new Error('UNIT_INVALID')
  return unit as StockUnitInput
}

function parseDate(value: unknown) {
  const cleaned = cleanText(value)
  if (!cleaned) return null
  const date = new Date(cleaned)
  if (Number.isNaN(date.getTime())) throw new Error('DATE_INVALID')
  return date
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0
  return Number(value)
}

function normalizeOperatingHours(value: unknown): OperatingHour[] {
  const source = Array.isArray(value) ? value : DEFAULT_OPERATING_HOURS
  const byDay = new Map<string, any>(source.map((item: any) => [String(item?.day), item]))

  return DAY_KEYS.map((day) => {
    const item = byDay.get(day)
    return {
      day,
      label: DAY_LABELS[day],
      enabled: typeof item?.enabled === 'boolean' ? item.enabled : day !== 'sun',
      startTime: isTime(item?.startTime) ? item.startTime : day === 'sat' ? '09:00' : '08:00',
      endTime: isTime(item?.endTime) ? item.endTime : day === 'sat' ? '13:00' : '18:00',
    }
  })
}

function isTime(value: unknown) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function getTodayKey(date = new Date()): WeekDayKey {
  return DAY_KEYS[date.getDay()]
}

function isInsideWindow(nowMinutes: number, startTime: string, endTime: string) {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  if (start === end) return true
  if (start < end) return nowMinutes >= start && nowMinutes <= end

  // Supports overnight shifts, ex: 18:00 -> 02:00.
  return nowMinutes >= start || nowMinutes <= end
}

function computeOnlineStatus(supplier: any) {
  const hours = normalizeOperatingHours(supplier.operatingHours)
  const now = new Date()
  const today = hours.find((item) => item.day === getTodayKey(now))
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const insideOperatingHours = Boolean(
    today?.enabled && isInsideWindow(nowMinutes, today.startTime, today.endTime)
  )

  return {
    onlineEnabled: Boolean(supplier.onlineEnabled),
    insideOperatingHours,
    isOnline: Boolean(supplier.onlineEnabled) && insideOperatingHours,
    today,
  }
}

async function generateSupplierCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = ''
    for (let i = 0; i < 8; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }

    const existing = await prisma.supplier.findUnique({ where: { ordrCode: code } })
    if (!existing) return code
  }

  throw new Error('SUPPLIER_CODE_GENERATION_FAILED')
}

async function assertSupplierCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) throw new Error('COMPANY_NOT_FOUND')
  if (String((company as any).companyType ?? 'BUSINESS') !== 'SUPPLIER') {
    throw new Error('SUPPLIER_COMPANY_REQUIRED')
  }
  return company
}

async function ensureSupplierProfile(companyId: string) {
  const company = await assertSupplierCompany(companyId)

  const existing = await prisma.supplier.findFirst({
    where: {
      OR: [
        { supplierCompanyId: companyId },
        { companyId, name: company.name },
      ],
    },
    include: SUPPLIER_INCLUDE,
  })

  if (existing) {
    const needsPatch = !existing.supplierCompanyId || !existing.ordrCode || !existing.operatingHours

    if (!needsPatch) return existing

    return prisma.supplier.update({
      where: { id: existing.id },
      data: {
        supplierCompanyId: existing.supplierCompanyId ?? companyId,
        ordrCode: existing.ordrCode ?? await generateSupplierCode(),
        operatingHours: existing.operatingHours ?? DEFAULT_OPERATING_HOURS,
      },
      include: SUPPLIER_INCLUDE,
    })
  }

  return prisma.supplier.create({
    data: {
      companyId,
      supplierCompanyId: companyId,
      name: company.name,
      ordrCode: await generateSupplierCode(),
      categories: [],
      onlineEnabled: true,
      operatingHours: DEFAULT_OPERATING_HOURS,
      priceTables: { create: { name: 'Tabela padrão' } },
    },
    include: SUPPLIER_INCLUDE,
  })
}

function serializeSupplier(supplier: any) {
  return {
    id: supplier.id,
    name: supplier.name,
    document: supplier.document ?? null,
    contactName: supplier.contactName ?? null,
    phone: supplier.phone ?? null,
    email: supplier.email ?? null,
    address: supplier.address ?? null,
    notes: supplier.notes ?? null,
    photoUrl: supplier.photoUrl ?? null,
    photoData: supplier.photoData ?? null,
    categories: supplier.categories ?? [],
    active: supplier.active,
    ordrCode: supplier.ordrCode ?? null,
    onlineEnabled: Boolean(supplier.onlineEnabled),
    publicListingEnabled: Boolean(supplier.publicListingEnabled),
    operatingHours: normalizeOperatingHours(supplier.operatingHours),
    onlineStatus: computeOnlineStatus(supplier),
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  }
}

function serializeTable(table: any) {
  const items = Array.isArray(table.items) ? table.items : []
  const averagePrice = items.length
    ? items.reduce((total: number, item: any) => total + decimalToNumber(item.unitPrice), 0) / items.length
    : 0

  return {
    id: table.id,
    name: table.name,
    description: table.description ?? null,
    active: table.active,
    validFrom: table.validFrom ?? null,
    validUntil: table.validUntil ?? null,
    updatedAt: table.updatedAt,
    itemCount: items.length,
    averagePrice,
    items: items.map(serializeItem),
  }
}

function serializeItem(item: any) {
  return {
    id: item.id,
    priceTableId: item.priceTableId,
    productId: item.productId ?? null,
    itemName: item.itemName,
    name: item.itemName,
    sku: item.sku ?? null,
    category: item.category ?? item.product?.category?.name ?? null,
    unit: item.unit,
    quantity: decimalToNumber(item.quantity),
    unitPrice: decimalToNumber(item.unitPrice),
    price: decimalToNumber(item.unitPrice),
    notes: item.notes ?? null,
    lastQuotedAt: item.lastQuotedAt ?? null,
    linkedStockProductName: item.product?.name ?? null,
    categoryEmoji: item.product?.category?.emoji ?? null,
  }
}

function serializePortal(supplier: any) {
  const profile = serializeSupplier(supplier)
  const tables = (supplier.priceTables ?? []).map(serializeTable)
  const products = tables.flatMap((table: any) =>
    table.items.map((item: any) => ({
      ...item,
      tableId: table.id,
      tableName: table.name,
      tableActive: table.active,
    }))
  )

  return { profile, tables, products }
}

export async function getDashboard(companyId: string) {
  const supplier = await ensureSupplierProfile(companyId)
  const { profile, tables, products } = serializePortal(supplier)
  const activeTables = tables.filter((table: any) => table.active)
  const linkedProducts = products.filter((product: any) => product.productId).length
  const visibleProducts = products.filter((product: any) => product.tableActive)

  return {
    supplier: profile,
    pendingOrders: 0,
    monthlyRevenue: 0,
    activePriceTables: activeTables.length,
    linkedProducts,
    productCount: visibleProducts.length,
    categories: profile.categories,
    onlineStatus: profile.onlineStatus,
    recentOrders: [],
    highlights: [
      { label: 'Código ORDR', value: profile.ordrCode ?? '-' },
      { label: 'Produtos ativos', value: String(visibleProducts.length) },
      { label: 'Tabelas ativas', value: String(activeTables.length) },
      { label: 'Produtos vinculados', value: String(linkedProducts) },
      { label: 'Visibilidade', value: profile.publicListingEnabled ? 'Público' : 'Por código' },
    ],
  }
}

export async function getProfile(companyId: string) {
  const supplier = await ensureSupplierProfile(companyId)
  return { supplier: serializeSupplier(supplier) }
}

export async function updateProfile(companyId: string, input: any) {
  const supplier = await ensureSupplierProfile(companyId)

  const updated = await prisma.supplier.update({
    where: { id: supplier.id },
    data: {
      name: typeof input.name === 'string' ? requiredText(input.name, 'SUPPLIER_NAME') : undefined,
      document: typeof input.document === 'undefined' ? undefined : cleanText(input.document),
      contactName: typeof input.contactName === 'undefined' ? undefined : cleanText(input.contactName),
      phone: typeof input.phone === 'undefined' ? undefined : cleanText(input.phone),
      email: typeof input.email === 'undefined' ? undefined : cleanText(input.email),
      address: typeof input.address === 'undefined' ? undefined : cleanText(input.address),
      notes: typeof input.notes === 'undefined' ? undefined : cleanText(input.notes),
      photoUrl: typeof input.photoUrl === 'undefined' ? undefined : cleanText(input.photoUrl),
      photoData: typeof input.photoData === 'undefined' ? undefined : cleanText(input.photoData),
      categories: typeof input.categories === 'undefined' ? undefined : parseCategories(input.categories),
      onlineEnabled: typeof input.onlineEnabled === 'boolean' ? input.onlineEnabled : undefined,
      publicListingEnabled: typeof input.publicListingEnabled === 'boolean' ? input.publicListingEnabled : undefined,
      operatingHours:
        typeof input.operatingHours === 'undefined'
          ? undefined
          : normalizeOperatingHours(input.operatingHours),
    },
    include: SUPPLIER_INCLUDE,
  })

  return { supplier: serializeSupplier(updated) }
}

function parseCategories(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 12)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => cleanText(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 12)
  }

  return []
}

export async function updateAvailability(companyId: string, onlineEnabled: boolean) {
  return updateProfile(companyId, { onlineEnabled })
}

export async function listProducts(companyId: string) {
  const supplier = await ensureSupplierProfile(companyId)
  const { products } = serializePortal(supplier)
  return { products }
}

export async function listPriceTables(companyId: string) {
  const supplier = await ensureSupplierProfile(companyId)
  const { tables } = serializePortal(supplier)
  return { tables }
}

export async function createPriceTable(companyId: string, input: any) {
  const supplier = await ensureSupplierProfile(companyId)

  await prisma.supplierPriceTable.create({
    data: {
      supplierId: supplier.id,
      name: requiredText(input.name, 'PRICE_TABLE_NAME'),
      description: cleanText(input.description),
      active: typeof input.active === 'boolean' ? input.active : true,
      validFrom: parseDate(input.validFrom),
      validUntil: parseDate(input.validUntil),
    },
  })

  return listPriceTables(companyId)
}

export async function updatePriceTable(companyId: string, tableId: string, input: any) {
  const supplier = await ensureSupplierProfile(companyId)
  const table = await prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } })
  if (!table) throw new Error('PRICE_TABLE_NOT_FOUND')

  await prisma.supplierPriceTable.update({
    where: { id: tableId },
    data: {
      name: typeof input.name === 'string' ? requiredText(input.name, 'PRICE_TABLE_NAME') : undefined,
      description: typeof input.description === 'undefined' ? undefined : cleanText(input.description),
      active: typeof input.active === 'boolean' ? input.active : undefined,
      validFrom: typeof input.validFrom === 'undefined' ? undefined : parseDate(input.validFrom),
      validUntil: typeof input.validUntil === 'undefined' ? undefined : parseDate(input.validUntil),
    },
  })

  return listPriceTables(companyId)
}

export async function deletePriceTable(companyId: string, tableId: string) {
  const supplier = await ensureSupplierProfile(companyId)
  const table = await prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } })
  if (!table) throw new Error('PRICE_TABLE_NOT_FOUND')

  await prisma.supplierPriceTable.delete({ where: { id: tableId } })
  return listPriceTables(companyId)
}

export async function createPriceTableItem(companyId: string, tableId: string, input: any) {
  const supplier = await ensureSupplierProfile(companyId)
  const table = await prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } })
  if (!table) throw new Error('PRICE_TABLE_NOT_FOUND')

  await prisma.supplierPriceTableItem.create({
    data: {
      priceTableId: tableId,
      itemName: requiredText(input.itemName ?? input.name, 'ITEM_NAME'),
      sku: cleanText(input.sku),
      category: cleanText(input.category),
      unit: parseUnit(input.unit),
      quantity: parseQuantity(input.quantity),
      unitPrice: parseMoney(input.unitPrice ?? input.price, 'UNIT_PRICE'),
      notes: cleanText(input.notes),
      lastQuotedAt: parseDate(input.lastQuotedAt) ?? new Date(),
    },
  })

  return listPriceTables(companyId)
}

export async function updatePriceTableItem(companyId: string, tableId: string, itemId: string, input: any) {
  const supplier = await ensureSupplierProfile(companyId)
  const table = await prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } })
  if (!table) throw new Error('PRICE_TABLE_NOT_FOUND')

  const item = await prisma.supplierPriceTableItem.findFirst({ where: { id: itemId, priceTableId: tableId } })
  if (!item) throw new Error('PRICE_TABLE_ITEM_NOT_FOUND')

  await prisma.supplierPriceTableItem.update({
    where: { id: itemId },
    data: {
      itemName: typeof input.itemName !== 'undefined' || typeof input.name !== 'undefined'
        ? requiredText(input.itemName ?? input.name, 'ITEM_NAME')
        : undefined,
      sku: typeof input.sku === 'undefined' ? undefined : cleanText(input.sku),
      category: typeof input.category === 'undefined' ? undefined : cleanText(input.category),
      unit: typeof input.unit === 'undefined' ? undefined : parseUnit(input.unit),
      quantity: typeof input.quantity === 'undefined' ? undefined : parseQuantity(input.quantity),
      unitPrice: typeof input.unitPrice === 'undefined' && typeof input.price === 'undefined'
        ? undefined
        : parseMoney(input.unitPrice ?? input.price, 'UNIT_PRICE'),
      notes: typeof input.notes === 'undefined' ? undefined : cleanText(input.notes),
      lastQuotedAt: typeof input.lastQuotedAt === 'undefined' ? undefined : parseDate(input.lastQuotedAt),
    },
  })

  return listPriceTables(companyId)
}

export async function deletePriceTableItem(companyId: string, tableId: string, itemId: string) {
  const supplier = await ensureSupplierProfile(companyId)
  const table = await prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } })
  if (!table) throw new Error('PRICE_TABLE_NOT_FOUND')

  await prisma.supplierPriceTableItem.deleteMany({ where: { id: itemId, priceTableId: tableId } })
  return listPriceTables(companyId)
}

export async function listOrders(companyId: string) {
  await ensureSupplierProfile(companyId)
  return { orders: [], paused: true }
}
