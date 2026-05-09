import { Prisma, StockUnit } from '@prisma/client'
import { prisma } from '../lib/prisma'

type ProductCostHistorySource =
  | 'manual'
  | 'buy_receive'
  | 'product_edit'
  | 'stock_adjustment'
  | 'migration'

type ProductCostHistoryFilters = {
  fromDate?: string
  toDate?: string
  productId?: string
  categoryId?: string
  source?: ProductCostHistorySource | 'all'
}

type ColumnRow = {
  column_name: string
}

type RawHistoryRow = {
  id: string
  companyId: string
  productId: string
  categoryId: string | null
  productName: string | null
  categoryName: string | null
  costMode: string | null
  source: ProductCostHistorySource | string | null
  reason: string | null
  metadata: unknown | null
  oldSimpleCost: Prisma.Decimal | number | string | null
  newSimpleCost: Prisma.Decimal | number | string | null
  oldReferenceCost: Prisma.Decimal | number | string | null
  newReferenceCost: Prisma.Decimal | number | string | null
  oldReferenceQuantity: Prisma.Decimal | number | string | null
  newReferenceQuantity: Prisma.Decimal | number | string | null
  oldStockUnit: StockUnit | string | null
  newStockUnit: StockUnit | string | null
  oldUnitContentQuantity: Prisma.Decimal | number | string | null
  newUnitContentQuantity: Prisma.Decimal | number | string | null
  oldUnitContentUnit: StockUnit | string | null
  newUnitContentUnit: StockUnit | string | null
  oldCostPerBaseUnit: Prisma.Decimal | number | string | null
  newCostPerBaseUnit: Prisma.Decimal | number | string | null
  createdAt: Date
  createdByUserId: string | null
  createdByUsername: string | null
  createdByName: string | null
}

function toNumber(value: unknown) {
  if (value == null) return 0
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function nullableNumber(value: unknown) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function parseDateStart(value?: string) {
  if (!value) return null

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

function parseDateEnd(value?: string) {
  if (!value) return null

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day, 23, 59, 59, 999)
}

function normalizeToBaseUnit(quantity: number, unit?: StockUnit | string | null) {
  if (!Number.isFinite(quantity)) return 0

  switch (unit) {
    case 'l':
    case 'kg':
      return quantity * 1000
    case 'ml':
    case 'g':
    case 'unit':
    default:
      return quantity
  }
}

function getUnitContentQuantity(product: {
  unitContentQuantity?: Prisma.Decimal | number | string | null
}) {
  const quantity = toNumber(product.unitContentQuantity)
  return quantity > 0 ? quantity : null
}

function getUnitContentUnit(product: {
  unitContentUnit?: StockUnit | null
}) {
  const unit = product.unitContentUnit ?? null
  return unit && unit !== 'unit' ? unit : null
}

function hasUnitContent(product: {
  stockUnit?: StockUnit | null
  unitContentQuantity?: Prisma.Decimal | number | string | null
  unitContentUnit?: StockUnit | null
}) {
  return (
    (product.stockUnit ?? 'unit') === 'unit' &&
    getUnitContentQuantity(product) != null &&
    getUnitContentUnit(product) != null
  )
}

function getEffectiveStockUnit(product: {
  stockUnit?: StockUnit | null
  unitContentQuantity?: Prisma.Decimal | number | string | null
  unitContentUnit?: StockUnit | null
}) {
  if (hasUnitContent(product)) {
    return getUnitContentUnit(product) ?? 'unit'
  }

  return product.stockUnit ?? 'unit'
}

/**
 * Cost per base unit:
 * - volume: R$/ml
 * - weight: R$/g
 * - count: R$/unit
 */
export function calculateProductCostPerBaseUnit(product: {
  simpleCost?: Prisma.Decimal | number | string | null
  referenceCost?: Prisma.Decimal | number | string | null
  referenceQuantity?: Prisma.Decimal | number | string | null
  stockUnit?: StockUnit | null
  unitContentQuantity?: Prisma.Decimal | number | string | null
  unitContentUnit?: StockUnit | null
}) {
  const referenceCost = toNumber(product.referenceCost)
  const referenceQuantity = toNumber(product.referenceQuantity)
  const simpleCost = toNumber(product.simpleCost)
  const effectiveUnit = getEffectiveStockUnit(product)

  if (referenceCost > 0 && referenceQuantity > 0) {
    const referenceBaseQuantity = hasUnitContent(product)
      ? normalizeToBaseUnit(
          referenceQuantity * (getUnitContentQuantity(product) ?? 1),
          getUnitContentUnit(product) ?? effectiveUnit
        )
      : normalizeToBaseUnit(referenceQuantity, effectiveUnit)

    return referenceBaseQuantity > 0
      ? round(referenceCost / referenceBaseQuantity)
      : null
  }

  if (simpleCost > 0) {
    if (hasUnitContent(product)) {
      const contentBaseQuantity = normalizeToBaseUnit(
        getUnitContentQuantity(product) ?? 1,
        getUnitContentUnit(product) ?? effectiveUnit
      )

      return contentBaseQuantity > 0
        ? round(simpleCost / contentBaseQuantity)
        : null
    }

    if (product.stockUnit === 'l' || product.stockUnit === 'kg') {
      return round(simpleCost / 1000)
    }

    return round(simpleCost)
  }

  return null
}

async function getProductCostHistoryColumns() {
  const rows = await prisma.$queryRaw<ColumnRow[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProductCostHistory'
  `

  return new Set(rows.map((row) => row.column_name))
}

function columnSelect(
  columns: Set<string>,
  columnName: string,
  alias = columnName,
  castText = false
) {
  if (!columns.has(columnName)) {
    return `NULL AS "${alias}"`
  }

  if (castText) {
    return `h."${columnName}"::text AS "${alias}"`
  }

  return `h."${columnName}" AS "${alias}"`
}

function nullableSqlValue(value: unknown) {
  return value == null ? null : value
}

export async function getProductCostHistoryFilters(companyId: string) {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
    }),

    prisma.product.findMany({
      where: {
        companyId,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        categoryId: true,
      },
    }),
  ])

  return {
    categories,
    products,
    sources: [
      'manual',
      'buy_receive',
      'product_edit',
      'stock_adjustment',
      'migration',
    ] satisfies ProductCostHistorySource[],
  }
}

export async function getProductCostHistory(
  companyId: string,
  filters: ProductCostHistoryFilters = {}
) {
  const columns = await getProductCostHistoryColumns()

  if (!columns.has('id')) {
    throw new Error('PRODUCT_COST_HISTORY_TABLE_NOT_READY')
  }

  const fromDate = parseDateStart(filters.fromDate)
  const toDate = parseDateEnd(filters.toDate)

  const productId =
    filters.productId && filters.productId !== 'all' ? filters.productId : null
  const categoryId =
    filters.categoryId && filters.categoryId !== 'all' ? filters.categoryId : null
  const source =
    filters.source && filters.source !== 'all' ? filters.source : null

  const selectParts = [
    columnSelect(columns, 'id'),
    columnSelect(columns, 'companyId'),
    columnSelect(columns, 'productId'),
    columnSelect(columns, 'categoryId'),
    `p."name" AS "productName"`,
    `COALESCE(c."name", pc."name", 'Sem categoria') AS "categoryName"`,
    `p."costMode"::text AS "costMode"`,
    columnSelect(columns, 'source', 'source', true),
    columnSelect(columns, 'reason'),
    columnSelect(columns, 'metadata'),
    columnSelect(columns, 'oldSimpleCost'),
    columnSelect(columns, 'newSimpleCost'),
    columnSelect(columns, 'oldReferenceCost'),
    columnSelect(columns, 'newReferenceCost'),
    columnSelect(columns, 'oldReferenceQuantity'),
    columnSelect(columns, 'newReferenceQuantity'),
    columnSelect(columns, 'oldStockUnit', 'oldStockUnit', true),
    columnSelect(columns, 'newStockUnit', 'newStockUnit', true),
    columnSelect(columns, 'oldUnitContentQuantity'),
    columnSelect(columns, 'newUnitContentQuantity'),
    columnSelect(columns, 'oldUnitContentUnit', 'oldUnitContentUnit', true),
    columnSelect(columns, 'newUnitContentUnit', 'newUnitContentUnit', true),
    columnSelect(columns, 'oldCostPerBaseUnit'),
    columnSelect(columns, 'newCostPerBaseUnit'),
    columnSelect(columns, 'createdAt'),
    columnSelect(columns, 'createdByUserId'),
    columns.has('createdByUserId') ? `u."username" AS "createdByUsername"` : `NULL AS "createdByUsername"`,
    columns.has('createdByUserId') ? `u."name" AS "createdByName"` : `NULL AS "createdByName"`,
  ]

  const createdByJoin = columns.has('createdByUserId')
    ? `LEFT JOIN "User" u ON u."id" = h."createdByUserId"`
    : ''

  const whereParts = [`h."companyId" = $1`]
  const values: unknown[] = [companyId]

  if (fromDate) {
    values.push(fromDate)
    whereParts.push(`h."createdAt" >= $${values.length}`)
  }

  if (toDate) {
    values.push(toDate)
    whereParts.push(`h."createdAt" <= $${values.length}`)
  }

  if (productId && columns.has('productId')) {
    values.push(productId)
    whereParts.push(`h."productId" = $${values.length}`)
  }

  if (categoryId && columns.has('categoryId')) {
    values.push(categoryId)
    whereParts.push(`h."categoryId" = $${values.length}`)
  }

  if (source && columns.has('source')) {
    values.push(source)
    whereParts.push(`h."source"::text = $${values.length}`)
  }

  const sql = `
    SELECT
      ${selectParts.join(',\n      ')}
    FROM "ProductCostHistory" h
    LEFT JOIN "Product" p ON p."id" = h."productId"
    LEFT JOIN "Category" c ON c."id" = h."categoryId"
    LEFT JOIN "Category" pc ON pc."id" = p."categoryId"
    ${createdByJoin}
    WHERE ${whereParts.join(' AND ')}
    ORDER BY h."createdAt" ASC
  `

  const rows = await prisma.$queryRawUnsafe<RawHistoryRow[]>(sql, ...values)

  const history = rows.map((row: RawHistoryRow) => {
    const oldCostPerBaseUnit =
      nullableNumber(row.oldCostPerBaseUnit) ??
      calculateProductCostPerBaseUnit({
        simpleCost: row.oldSimpleCost,
        referenceCost: row.oldReferenceCost,
        referenceQuantity: row.oldReferenceQuantity,
        stockUnit: row.oldStockUnit as StockUnit | null,
        unitContentQuantity: row.oldUnitContentQuantity,
        unitContentUnit: row.oldUnitContentUnit as StockUnit | null,
      })

    const newCostPerBaseUnit =
      nullableNumber(row.newCostPerBaseUnit) ??
      calculateProductCostPerBaseUnit({
        simpleCost: row.newSimpleCost,
        referenceCost: row.newReferenceCost,
        referenceQuantity: row.newReferenceQuantity,
        stockUnit: row.newStockUnit as StockUnit | null,
        unitContentQuantity: row.newUnitContentQuantity,
        unitContentUnit: row.newUnitContentUnit as StockUnit | null,
      })

    const delta =
      oldCostPerBaseUnit != null && newCostPerBaseUnit != null
        ? newCostPerBaseUnit - oldCostPerBaseUnit
        : null

    const deltaPercent =
      oldCostPerBaseUnit != null &&
      oldCostPerBaseUnit > 0 &&
      newCostPerBaseUnit != null
        ? ((newCostPerBaseUnit - oldCostPerBaseUnit) / oldCostPerBaseUnit) * 100
        : null

    return {
      id: row.id,
      companyId: row.companyId,
      productId: row.productId,
      productName: row.productName ?? 'Produto removido',
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? 'Sem categoria',
      costMode: row.costMode,

      source: row.source ?? 'manual',
      reason: row.reason,
      metadata: row.metadata,

      oldSimpleCost: nullableNumber(row.oldSimpleCost),
      newSimpleCost: nullableNumber(row.newSimpleCost),
      oldReferenceCost: nullableNumber(row.oldReferenceCost),
      newReferenceCost: nullableNumber(row.newReferenceCost),
      oldReferenceQuantity: nullableNumber(row.oldReferenceQuantity),
      newReferenceQuantity: nullableNumber(row.newReferenceQuantity),
      oldStockUnit: row.oldStockUnit,
      newStockUnit: row.newStockUnit,
      oldUnitContentQuantity: nullableNumber(row.oldUnitContentQuantity),
      newUnitContentQuantity: nullableNumber(row.newUnitContentQuantity),
      oldUnitContentUnit: row.oldUnitContentUnit,
      newUnitContentUnit: row.newUnitContentUnit,

      oldCostPerBaseUnit,
      newCostPerBaseUnit,
      delta: delta == null ? null : round(delta),
      deltaPercent: deltaPercent == null ? null : round(deltaPercent, 2),

      createdAt: row.createdAt.toISOString(),
      createdByUser: row.createdByUserId
        ? {
            id: row.createdByUserId,
            username: row.createdByUsername,
            name: row.createdByName,
          }
        : null,
    }
  })

  const productMap = new Map<
    string,
    {
      productId: string
      productName: string
      categoryId: string | null
      categoryName: string
      points: number
      firstCost: number | null
      lastCost: number | null
      minCost: number | null
      maxCost: number | null
      averageCost: number | null
      delta: number | null
      deltaPercent: number | null
    }
  >()

  const categoryMap = new Map<
    string,
    {
      categoryId: string | null
      categoryName: string
      points: number
      averageCost: number
      minCost: number | null
      maxCost: number | null
    }
  >()

  for (const item of history) {
    const cost = item.newCostPerBaseUnit
    if (cost == null) continue

    const existingProduct = productMap.get(item.productId) ?? {
      productId: item.productId,
      productName: item.productName,
      categoryId: item.categoryId ?? null,
      categoryName: item.categoryName,
      points: 0,
      firstCost: null,
      lastCost: null,
      minCost: null,
      maxCost: null,
      averageCost: null,
      delta: null,
      deltaPercent: null,
    }

    existingProduct.points += 1
    existingProduct.firstCost ??= cost
    existingProduct.lastCost = cost
    existingProduct.minCost =
      existingProduct.minCost == null
        ? cost
        : Math.min(existingProduct.minCost, cost)
    existingProduct.maxCost =
      existingProduct.maxCost == null
        ? cost
        : Math.max(existingProduct.maxCost, cost)
    existingProduct.averageCost =
      ((existingProduct.averageCost ?? 0) * (existingProduct.points - 1) + cost) /
      existingProduct.points

    if (existingProduct.firstCost != null && existingProduct.lastCost != null) {
      existingProduct.delta = existingProduct.lastCost - existingProduct.firstCost
      existingProduct.deltaPercent =
        existingProduct.firstCost > 0
          ? (existingProduct.delta / existingProduct.firstCost) * 100
          : null
    }

    productMap.set(item.productId, existingProduct)

    const categoryKey = item.categoryId ?? 'uncategorized'
    const existingCategory = categoryMap.get(categoryKey) ?? {
      categoryId: item.categoryId ?? null,
      categoryName: item.categoryName,
      points: 0,
      averageCost: 0,
      minCost: null,
      maxCost: null,
    }

    existingCategory.points += 1
    existingCategory.averageCost =
      (existingCategory.averageCost * (existingCategory.points - 1) + cost) /
      existingCategory.points
    existingCategory.minCost =
      existingCategory.minCost == null
        ? cost
        : Math.min(existingCategory.minCost, cost)
    existingCategory.maxCost =
      existingCategory.maxCost == null
        ? cost
        : Math.max(existingCategory.maxCost, cost)

    categoryMap.set(categoryKey, existingCategory)
  }

  const chart = history
    .filter((item) => item.newCostPerBaseUnit != null)
    .map((item) => ({
      id: item.id,
      date: item.createdAt.slice(0, 10),
      createdAt: item.createdAt,
      productId: item.productId,
      productName: item.productName,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      cost: item.newCostPerBaseUnit,
      oldCost: item.oldCostPerBaseUnit,
      delta: item.delta,
      deltaPercent: item.deltaPercent,
      source: item.source,
    }))

  return {
    filters,
    summary: {
      totalChanges: history.length,
      productsChanged: productMap.size,
      categoriesChanged: categoryMap.size,
      increases: history.filter((item) => (item.delta ?? 0) > 0).length,
      decreases: history.filter((item) => (item.delta ?? 0) < 0).length,
    },
    chart,
    history: [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    products: Array.from(productMap.values()).map((item) => ({
      ...item,
      firstCost: item.firstCost == null ? null : round(item.firstCost),
      lastCost: item.lastCost == null ? null : round(item.lastCost),
      minCost: item.minCost == null ? null : round(item.minCost),
      maxCost: item.maxCost == null ? null : round(item.maxCost),
      averageCost: item.averageCost == null ? null : round(item.averageCost),
      delta: item.delta == null ? null : round(item.delta),
      deltaPercent: item.deltaPercent == null ? null : round(item.deltaPercent, 2),
    })),
    categories: Array.from(categoryMap.values()).map((item) => ({
      ...item,
      averageCost: round(item.averageCost),
      minCost: item.minCost == null ? null : round(item.minCost),
      maxCost: item.maxCost == null ? null : round(item.maxCost),
    })),
  }
}

/**
 * Use this when product cost is changed by backend services.
 *
 * This function adapts to the actual columns that exist in ProductCostHistory,
 * so it will not fail if optional columns like createdByUserId or costPerBaseUnit
 * were not created yet.
 */
export async function createProductCostHistoryEntry(params: {
  tx?: Prisma.TransactionClient
  companyId: string
  productId: string
  source?: ProductCostHistorySource
  reason?: string | null
  metadata?: Prisma.InputJsonValue
  createdByUserId?: string | null
  oldProduct?: {
    simpleCost?: Prisma.Decimal | number | string | null
    referenceCost?: Prisma.Decimal | number | string | null
    referenceQuantity?: Prisma.Decimal | number | string | null
    stockUnit?: StockUnit | null
    unitContentQuantity?: Prisma.Decimal | number | string | null
    unitContentUnit?: StockUnit | null
    categoryId?: string | null
    categoryName?: string | null
  } | null
  newProduct?: {
    simpleCost?: Prisma.Decimal | number | string | null
    referenceCost?: Prisma.Decimal | number | string | null
    referenceQuantity?: Prisma.Decimal | number | string | null
    stockUnit?: StockUnit | null
    unitContentQuantity?: Prisma.Decimal | number | string | null
    unitContentUnit?: StockUnit | null
    categoryId?: string | null
    categoryName?: string | null
  } | null
}) {
  const client = params.tx ?? prisma
  const columns = await getProductCostHistoryColumns()

  const product =
    params.newProduct ??
    (await client.product.findFirst({
      where: {
        id: params.productId,
        companyId: params.companyId,
      },
      select: {
        categoryId: true,
        simpleCost: true,
        referenceCost: true,
        referenceQuantity: true,
        stockUnit: true,
        unitContentQuantity: true,
        unitContentUnit: true,
      },
    }))

  if (!product) return null

  const oldProduct = params.oldProduct ?? null
  const oldCostPerBaseUnit = oldProduct
    ? calculateProductCostPerBaseUnit(oldProduct)
    : null
  const newCostPerBaseUnit = calculateProductCostPerBaseUnit(product)

  const id = `cost_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`

  const valuesByColumn: Record<string, unknown> = {
    id,
    companyId: params.companyId,
    productId: params.productId,
    categoryId: product.categoryId ?? oldProduct?.categoryId ?? null,
    source: params.source ?? 'manual',
    oldSimpleCost: oldProduct?.simpleCost ?? null,
    newSimpleCost: product.simpleCost ?? null,
    oldReferenceCost: oldProduct?.referenceCost ?? null,
    newReferenceCost: product.referenceCost ?? null,
    oldReferenceQuantity: oldProduct?.referenceQuantity ?? null,
    newReferenceQuantity: product.referenceQuantity ?? null,
    oldStockUnit: oldProduct?.stockUnit ?? null,
    newStockUnit: product.stockUnit ?? null,
    oldUnitContentQuantity: oldProduct?.unitContentQuantity ?? null,
    newUnitContentQuantity: product.unitContentQuantity ?? null,
    oldUnitContentUnit: oldProduct?.unitContentUnit ?? null,
    newUnitContentUnit: product.unitContentUnit ?? null,
    oldCostPerBaseUnit,
    newCostPerBaseUnit,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null,
    createdAt: new Date(),
    createdByUserId: params.createdByUserId ?? null,
  }

  const insertColumns = Object.keys(valuesByColumn).filter((column) =>
    columns.has(column)
  )

  const quotedColumns = insertColumns.map((column) => `"${column}"`).join(', ')
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ')
  const values = insertColumns.map((column) => nullableSqlValue(valuesByColumn[column]))

  const sql = `
    INSERT INTO "ProductCostHistory" (${quotedColumns})
    VALUES (${placeholders})
  `

  await client.$executeRawUnsafe(sql, ...values)

  return { id }
}
