import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type StockUnitInput = 'unit' | 'ml' | 'l' | 'g' | 'kg'
type WeekDayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

type OperatingHour = {
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

function parseDate(value: unknown) {
  const cleaned = cleanText(value)
  if (!cleaned) return null
  const date = new Date(cleaned)
  if (Number.isNaN(date.getTime())) throw new Error('DATE_INVALID')
  return date
}

function parseUnit(value: unknown): StockUnitInput {
  const unit = cleanText(value) ?? 'unit'
  if (!['unit', 'ml', 'l', 'g', 'kg'].includes(unit)) throw new Error('UNIT_INVALID')
  return unit as StockUnitInput
}

function isTime(value: unknown) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
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

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function isInsideWindow(nowMinutes: number, startTime: string, endTime: string) {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  if (start === end) return true
  if (start < end) return nowMinutes >= start && nowMinutes <= end
  return nowMinutes >= start || nowMinutes <= end
}

function getTodayKey(date = new Date()): WeekDayKey {
  return DAY_KEYS[date.getDay()]
}

function computeOnlineStatus(supplier: any) {
  const hours = normalizeOperatingHours(supplier.operatingHours)
  const now = new Date()
  const today = hours.find((item) => item.day === getTodayKey(now))
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const insideOperatingHours = Boolean(today?.enabled && isInsideWindow(nowMinutes, today.startTime, today.endTime))

  return {
    onlineEnabled: Boolean(supplier.onlineEnabled),
    insideOperatingHours,
    isOnline: Boolean(supplier.onlineEnabled) && insideOperatingHours,
    today: today ?? null,
  }
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0
  return Number(value)
}

function serializeItem(item: any) {
  return {
    id: item.id,
    priceTableId: item.priceTableId,
    productId: item.productId ?? null,
    product: item.product ?? null,
    itemName: item.itemName,
    name: item.itemName,
    sku: item.sku ?? null,
    category: item.category ?? item.product?.category?.name ?? null,
    unit: item.unit,
    quantity: decimalToNumber(item.quantity),
    unitPrice: decimalToNumber(item.unitPrice),
    notes: item.notes ?? null,
    lastQuotedAt: item.lastQuotedAt ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function serializeTable(table: any, readonly = false) {
  return {
    id: table.id,
    supplierId: table.supplierId,
    name: table.name,
    description: table.description ?? null,
    active: table.active,
    validFrom: table.validFrom ?? null,
    validUntil: table.validUntil ?? null,
    items: (table.items ?? []).map(serializeItem),
    readonly,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  }
}

function serializeSupplierForCompany(supplier: any, companyId: string) {
  const isOwnSupplier = supplier.companyId === companyId
  const hasCodeAccess = Boolean(supplier.businessAccesses?.length)
  const isPublic = Boolean(supplier.publicListingEnabled)
  const readonly = !isOwnSupplier
  const accessMode = isOwnSupplier ? 'OWN' : hasCodeAccess ? 'CODE' : 'PUBLIC'
  const visibleTables = readonly
    ? (supplier.priceTables ?? []).filter((table: any) => table.active)
    : supplier.priceTables ?? []

  return {
    id: supplier.id,
    companyId: supplier.companyId,
    supplierCompanyId: supplier.supplierCompanyId ?? null,
    name: supplier.name,
    document: readonly ? null : supplier.document ?? null,
    contactName: supplier.contactName ?? null,
    phone: supplier.phone ?? null,
    email: supplier.email ?? null,
    address: supplier.address ?? null,
    notes: supplier.notes ?? null,
    photoUrl: supplier.photoUrl ?? null,
    photoData: supplier.photoData ?? null,
    categories: supplier.categories ?? [],
    active: supplier.active,
    ordrCode: readonly ? null : supplier.ordrCode ?? null,
    onlineEnabled: Boolean(supplier.onlineEnabled),
    publicListingEnabled: Boolean(supplier.publicListingEnabled),
    operatingHours: normalizeOperatingHours(supplier.operatingHours),
    onlineStatus: computeOnlineStatus(supplier),
    readonly,
    canManage: isOwnSupplier,
    isExternal: !isOwnSupplier,
    accessMode,
    isPublic,
    hasCodeAccess,
    priceTables: visibleTables.map((table: any) => serializeTable(table, readonly)),
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  }
}

async function assertSupplier(companyId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } })
  if (!supplier) throw new Error('SUPPLIER_NOT_FOUND')
  return supplier
}

async function assertPriceTable(companyId: string, supplierId: string, priceTableId: string) {
  await assertSupplier(companyId, supplierId)
  const table = await prisma.supplierPriceTable.findFirst({
    where: { id: priceTableId, supplier: { companyId, id: supplierId } },
  })
  if (!table) throw new Error('PRICE_TABLE_NOT_FOUND')
  return table
}

async function assertProductBelongsToCompany(companyId: string, productId: string | null) {
  if (!productId) return null
  const product = await prisma.product.findFirst({ where: { id: productId, companyId, deletedAt: null } })
  if (!product) throw new Error('PRODUCT_NOT_FOUND')
  return product
}

function supplierVisibilityWhere(companyId: string): Prisma.SupplierWhereInput {
  return {
    OR: [
      { companyId },
      {
        companyId: { not: companyId },
        active: true,
        supplierCompanyId: { not: null },
        OR: [
          { publicListingEnabled: true },
          { businessAccesses: { some: { businessCompanyId: companyId } } },
        ],
      },
    ],
  }
}

function supplierIncludeForCompany(companyId: string) {
  return {
    ...SUPPLIER_INCLUDE,
    businessAccesses: {
      where: { businessCompanyId: companyId },
      select: { id: true, codeUsed: true, createdAt: true },
    },
  }
}

export async function listSuppliers(companyId: string) {
  const suppliers = await prisma.supplier.findMany({
    where: supplierVisibilityWhere(companyId),
    include: supplierIncludeForCompany(companyId),
    orderBy: [{ active: 'desc' }, { publicListingEnabled: 'desc' }, { name: 'asc' }],
  })

  return suppliers.map((supplier) => serializeSupplierForCompany(supplier, companyId))
}

export async function getSupplier(companyId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, AND: [supplierVisibilityWhere(companyId)] },
    include: supplierIncludeForCompany(companyId),
  })
  if (!supplier) throw new Error('SUPPLIER_NOT_FOUND')
  return serializeSupplierForCompany(supplier, companyId)
}

export async function addSupplierAccessByCode(companyId: string, rawCode: string) {
  const code = requiredText(rawCode, 'ORDR_CODE').toUpperCase().replace(/[^A-Z0-9]/g, '')

  const supplier = await prisma.supplier.findFirst({
    where: {
      ordrCode: code,
      active: true,
      supplierCompanyId: { not: null },
      companyId: { not: companyId },
    },
  })

  if (!supplier) throw new Error('SUPPLIER_CODE_NOT_FOUND')

  await prisma.supplierAccess.upsert({
    where: {
      businessCompanyId_supplierId: {
        businessCompanyId: companyId,
        supplierId: supplier.id,
      },
    },
    create: {
      businessCompanyId: companyId,
      supplierId: supplier.id,
      codeUsed: code,
    },
    update: { codeUsed: code },
  })

  return getSupplier(companyId, supplier.id)
}

export async function createSupplier(input: {
  companyId: string
  name: string
  document?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  photoUrl?: string | null
  photoData?: string | null
  categories?: string[] | string | null
  createDefaultTable?: boolean
}) {
  const name = requiredText(input.name, 'SUPPLIER_NAME')

  const supplier = await prisma.supplier.create({
    data: {
      companyId: input.companyId,
      name,
      document: cleanText(input.document),
      contactName: cleanText(input.contactName),
      phone: cleanText(input.phone),
      email: cleanText(input.email),
      address: cleanText(input.address),
      notes: cleanText(input.notes),
      photoUrl: cleanText(input.photoUrl),
      photoData: cleanText(input.photoData),
      categories: parseCategories(input.categories),
      priceTables: input.createDefaultTable === false ? undefined : { create: { name: 'Tabela padrão' } },
    },
    include: supplierIncludeForCompany(input.companyId),
  })

  return serializeSupplierForCompany(supplier, input.companyId)
}

export async function updateSupplier(input: {
  companyId: string
  supplierId: string
  name?: string
  document?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  photoUrl?: string | null
  photoData?: string | null
  categories?: string[] | string | null
  active?: boolean
}) {
  await assertSupplier(input.companyId, input.supplierId)

  const supplier = await prisma.supplier.update({
    where: { id: input.supplierId },
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
      active: typeof input.active === 'boolean' ? input.active : undefined,
    },
    include: supplierIncludeForCompany(input.companyId),
  })

  return serializeSupplierForCompany(supplier, input.companyId)
}

export async function deactivateSupplier(companyId: string, supplierId: string) {
  const supplier = await assertSupplier(companyId, supplierId)
  if (!supplier.active) return getSupplier(companyId, supplierId)

  await prisma.supplier.update({ where: { id: supplierId }, data: { active: false } })
  return getSupplier(companyId, supplierId)
}

export async function reactivateSupplier(companyId: string, supplierId: string) {
  const supplier = await assertSupplier(companyId, supplierId)
  if (supplier.active) return getSupplier(companyId, supplierId)

  await prisma.supplier.update({ where: { id: supplierId }, data: { active: true } })
  return getSupplier(companyId, supplierId)
}

export async function deleteInactiveSupplier(companyId: string, supplierId: string) {
  const supplier = await assertSupplier(companyId, supplierId)
  if (supplier.active) throw new Error('SUPPLIER_MUST_BE_INACTIVE_TO_DELETE')

  await prisma.supplier.delete({ where: { id: supplierId } })
  return { deleted: true, supplierId }
}

export async function createSupplierPriceTable(input: {
  companyId: string
  supplierId: string
  name: string
  description?: string | null
  validFrom?: string | null
  validUntil?: string | null
}) {
  await assertSupplier(input.companyId, input.supplierId)
  await prisma.supplierPriceTable.create({
    data: {
      supplierId: input.supplierId,
      name: requiredText(input.name, 'PRICE_TABLE_NAME'),
      description: cleanText(input.description),
      validFrom: parseDate(input.validFrom),
      validUntil: parseDate(input.validUntil),
    },
  })
  return getSupplier(input.companyId, input.supplierId)
}

export async function updateSupplierPriceTable(input: {
  companyId: string
  supplierId: string
  priceTableId: string
  name?: string
  description?: string | null
  active?: boolean
  validFrom?: string | null
  validUntil?: string | null
}) {
  await assertPriceTable(input.companyId, input.supplierId, input.priceTableId)
  await prisma.supplierPriceTable.update({
    where: { id: input.priceTableId },
    data: {
      name: typeof input.name === 'string' ? requiredText(input.name, 'PRICE_TABLE_NAME') : undefined,
      description: typeof input.description === 'undefined' ? undefined : cleanText(input.description),
      active: typeof input.active === 'boolean' ? input.active : undefined,
      validFrom: typeof input.validFrom === 'undefined' ? undefined : parseDate(input.validFrom),
      validUntil: typeof input.validUntil === 'undefined' ? undefined : parseDate(input.validUntil),
    },
  })
  return getSupplier(input.companyId, input.supplierId)
}

export async function deleteSupplierPriceTable(input: {
  companyId: string
  supplierId: string
  priceTableId: string
}) {
  await assertPriceTable(input.companyId, input.supplierId, input.priceTableId)
  await prisma.supplierPriceTable.delete({ where: { id: input.priceTableId } })
  return getSupplier(input.companyId, input.supplierId)
}

export async function createSupplierPriceTableItem(input: {
  companyId: string
  supplierId: string
  priceTableId: string
  productId?: string | null
  itemName?: string | null
  sku?: string | null
  category?: string | null
  unit?: StockUnitInput | null
  quantity?: number | string | null
  unitPrice: number | string
  notes?: string | null
  lastQuotedAt?: string | null
}) {
  await assertPriceTable(input.companyId, input.supplierId, input.priceTableId)
  const productId = cleanText(input.productId)
  const product = await assertProductBelongsToCompany(input.companyId, productId)

  await prisma.supplierPriceTableItem.create({
    data: {
      priceTableId: input.priceTableId,
      productId,
      itemName: requiredText(input.itemName ?? product?.name, 'ITEM_NAME'),
      sku: cleanText(input.sku),
      category: cleanText(input.category),
      unit: parseUnit(input.unit ?? product?.stockUnit ?? 'unit'),
      quantity: parseQuantity(input.quantity),
      unitPrice: parseMoney(input.unitPrice, 'UNIT_PRICE'),
      notes: cleanText(input.notes),
      lastQuotedAt: parseDate(input.lastQuotedAt) ?? new Date(),
    },
  })
  return getSupplier(input.companyId, input.supplierId)
}

export async function updateSupplierPriceTableItem(input: {
  companyId: string
  supplierId: string
  priceTableId: string
  itemId: string
  productId?: string | null
  itemName?: string | null
  sku?: string | null
  category?: string | null
  unit?: StockUnitInput | null
  quantity?: number | string | null
  unitPrice?: number | string
  notes?: string | null
  lastQuotedAt?: string | null
}) {
  await assertPriceTable(input.companyId, input.supplierId, input.priceTableId)
  const existing = await prisma.supplierPriceTableItem.findFirst({
    where: { id: input.itemId, priceTableId: input.priceTableId },
  })
  if (!existing) throw new Error('PRICE_TABLE_ITEM_NOT_FOUND')

  const productId = typeof input.productId === 'undefined' ? undefined : cleanText(input.productId)
  const product = typeof productId === 'undefined' ? null : await assertProductBelongsToCompany(input.companyId, productId)

  await prisma.supplierPriceTableItem.update({
    where: { id: input.itemId },
    data: {
      productId,
      itemName:
        typeof input.itemName === 'undefined' && typeof productId === 'undefined'
          ? undefined
          : requiredText(input.itemName ?? product?.name ?? existing.itemName, 'ITEM_NAME'),
      sku: typeof input.sku === 'undefined' ? undefined : cleanText(input.sku),
      category: typeof input.category === 'undefined' ? undefined : cleanText(input.category),
      unit: typeof input.unit === 'undefined' ? undefined : parseUnit(input.unit),
      quantity: typeof input.quantity === 'undefined' ? undefined : parseQuantity(input.quantity),
      unitPrice: typeof input.unitPrice === 'undefined' ? undefined : parseMoney(input.unitPrice, 'UNIT_PRICE'),
      notes: typeof input.notes === 'undefined' ? undefined : cleanText(input.notes),
      lastQuotedAt: typeof input.lastQuotedAt === 'undefined' ? undefined : parseDate(input.lastQuotedAt),
    },
  })
  return getSupplier(input.companyId, input.supplierId)
}

export async function deleteSupplierPriceTableItem(input: {
  companyId: string
  supplierId: string
  priceTableId: string
  itemId: string
}) {
  await assertPriceTable(input.companyId, input.supplierId, input.priceTableId)
  await prisma.supplierPriceTableItem.deleteMany({
    where: { id: input.itemId, priceTableId: input.priceTableId },
  })
  return getSupplier(input.companyId, input.supplierId)
}
