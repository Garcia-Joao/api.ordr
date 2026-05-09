import fs from 'fs/promises'
import path from 'path'
import { BuyRequestItemStatus, BuyRequestStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { getSelectedOrderPrinterName } from './printers.service'
import { createProductCostHistoryEntry } from './product-cost-history.service'

const { printRawThermalText } = require('../../printer.js')

type CartItemInput = {
  productId: string
  quantity: number | string
  notes?: string | null
}

type ConfirmCartInput = {
  companyId: string
  title?: string | null
  supplierName?: string | null
  notes?: string | null
  eventDateId?: string | null
}

type ReceiveItemInput = {
  itemId: string
  boughtQuantity: number | string
  unitPrice?: number | string | null
  totalPrice?: number | string | null
  status?: BuyRequestItemStatus
  notes?: string | null
}

type ReceiveBuyRequestInput = {
  companyId: string
  buyRequestId: string
  items: ReceiveItemInput[]
}

type BuyCart = {
  companyId: string
  title: string
  supplierName: string | null
  notes: string | null
  eventDateId: string | null
  items: Array<{
    productId: string
    quantity: number
    notes: string | null
    addedAt: string
    updatedAt: string
  }>
  updatedAt: string
}

const DATA_DIR = path.resolve(process.cwd(), 'data')
const CARTS_FILE = path.join(DATA_DIR, 'buy-carts.json')

function cleanText(value?: string | null) {
  return value?.trim() || null
}

function asPositiveNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) return fallback
  return numberValue
}

function asDecimalOrNull(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) return null
  return new Prisma.Decimal(numberValue)
}

async function readCartsFile(): Promise<Record<string, BuyCart>> {
  try {
    const raw = await fs.readFile(CARTS_FILE, 'utf8')
    return JSON.parse(raw) as Record<string, BuyCart>
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {}
    throw error
  }
}

async function writeCartsFile(carts: Record<string, BuyCart>) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(CARTS_FILE, JSON.stringify(carts, null, 2), 'utf8')
}

function emptyCart(companyId: string): BuyCart {
  const now = new Date().toISOString()

  return {
    companyId,
    title: 'Nova compra',
    supplierName: null,
    notes: null,
    eventDateId: null,
    items: [],
    updatedAt: now,
  }
}

const buyRequestInclude = {
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
      createdAt: 'asc' as const,
    },
  },
}

async function getProductUnitCost(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return 0

  const referenceCost = Number(product.referenceCost ?? 0)
  const referenceQuantity = Number(product.referenceQuantity ?? 0)
  const simpleCost = Number(product.simpleCost ?? 0)

  if (referenceCost > 0 && referenceQuantity > 0) {
    return referenceCost / referenceQuantity
  }

  if (simpleCost > 0) return simpleCost

  return 0
}

async function updateStockAndCostForBoughtItem(params: {
  tx: Prisma.TransactionClient
  companyId: string
  productId: string
  boughtQuantity: number
  totalPaid: number
  buyRequestId: string
}) {
  const product = await params.tx.product.findFirst({
    where: {
      id: params.productId,
      companyId: params.companyId,
    },
  })

  if (!product) {
    throw new Error('PRODUCT_NOT_FOUND')
  }

  if (params.boughtQuantity <= 0 || params.totalPaid < 0) return

  const previousQty = Number(product.stockQuantity ?? 0)
  const newQty = previousQty + params.boughtQuantity

  const referenceCost = Number(product.referenceCost ?? 0)
  const referenceQuantity = Number(product.referenceQuantity ?? 0)
  const simpleCost = Number(product.simpleCost ?? 0)

  const previousUnitCost =
    referenceCost > 0 && referenceQuantity > 0
      ? referenceCost / referenceQuantity
      : simpleCost > 0
        ? simpleCost
        : 0

  const previousInventoryValue =
    previousQty > 0 && previousUnitCost > 0 ? previousQty * previousUnitCost : 0

  const newUnitCost =
    newQty > 0
      ? (previousInventoryValue + params.totalPaid) / newQty
      : params.boughtQuantity > 0
        ? params.totalPaid / params.boughtQuantity
        : previousUnitCost

  const directPurchaseUnitCost =
    params.boughtQuantity > 0 ? params.totalPaid / params.boughtQuantity : 0

  await params.tx.product.update({
    where: { id: product.id },
    data: {
      trackStock: true,
      stockQuantity: newQty,

      // Keep the product cost as weighted average for inventory/profit estimates.
      simpleCost: new Prisma.Decimal(newUnitCost),
      referenceQuantity: new Prisma.Decimal(1),
      referenceCost: new Prisma.Decimal(newUnitCost),
    },
  })

  const directPurchaseCostSnapshot = {
    ...product,

    // Save the exact price paid in this buy request to history.
    // Example:
    // boughtQuantity = 2, totalPaid = 30
    // ProductCostHistory will store referenceCost = 30 and referenceQuantity = 2,
    // so the chart shows R$15/unit for this purchase, not the weighted average.
    simpleCost: new Prisma.Decimal(directPurchaseUnitCost),
    referenceQuantity: new Prisma.Decimal(params.boughtQuantity),
    referenceCost: new Prisma.Decimal(params.totalPaid),
  }

  await createProductCostHistoryEntry({
    tx: params.tx,
    companyId: params.companyId,
    productId: product.id,
    source: 'buy_receive',
    reason: `Preço pago ao receber compra ${params.buyRequestId}`,
    oldProduct: product,
    newProduct: directPurchaseCostSnapshot,
    metadata: {
      buyRequestId: params.buyRequestId,
      boughtQuantity: params.boughtQuantity,
      totalPaid: params.totalPaid,
      directPurchaseUnitCost,
      previousQty,
      newQty,
      previousUnitCost,
      weightedAverageUnitCost: newUnitCost,
    },
  })

  await params.tx.stockMovement.create({
    data: {
      companyId: params.companyId,
      productId: product.id,
      type: 'purchase',
      quantity: params.boughtQuantity,
      previousQty,
      newQty,
      reason: `Compra ${params.buyRequestId}`,
    },
  })
}

export async function getBuyCart(companyId: string) {
  const carts = await readCartsFile()
  const cart = carts[companyId] ?? emptyCart(companyId)

  const products = await prisma.product.findMany({
    where: {
      companyId,
      active: true,
      trackStock: true,
      unlimitedStock: false,
      madeOnDemand: false,
      costMode: {
        not: 'recipe',
      },
      recipeItems: {
        none: {},
      },
    },
    include: {
      category: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  const productsById = new Map(products.map((product) => [product.id, product]))

  return {
    ...cart,
    items: cart.items
      .map((item) => {
        const product = productsById.get(item.productId)
        if (!product) return null

        return {
          ...item,
          product,
        }
      })
      .filter(Boolean),
  }
}

export async function updateBuyCart(companyId: string, input: Partial<BuyCart>) {
  const carts = await readCartsFile()
  const current = carts[companyId] ?? emptyCart(companyId)

  const next: BuyCart = {
    ...current,
    title: cleanText(input.title) ?? current.title,
    supplierName:
      input.supplierName === undefined
        ? current.supplierName
        : cleanText(input.supplierName),
    notes: input.notes === undefined ? current.notes : cleanText(input.notes),
    eventDateId:
      input.eventDateId === undefined
        ? current.eventDateId
        : cleanText(input.eventDateId),
    updatedAt: new Date().toISOString(),
  }

  carts[companyId] = next
  await writeCartsFile(carts)

  return getBuyCart(companyId)
}

export async function addOrUpdateBuyCartItem(companyId: string, input: CartItemInput) {
  const quantity = asPositiveNumber(input.quantity)
  if (quantity <= 0) throw new Error('INVALID_QUANTITY')

  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      companyId,
      active: true,
      trackStock: true,
      unlimitedStock: false,
      madeOnDemand: false,
      costMode: {
        not: 'recipe',
      },
      recipeItems: {
        none: {},
      },
    },
  })

  if (!product) throw new Error('PRODUCT_NOT_FOUND')

  const carts = await readCartsFile()
  const current = carts[companyId] ?? emptyCart(companyId)
  const now = new Date().toISOString()

  const existing = current.items.find((item) => item.productId === input.productId)

  if (existing) {
    existing.quantity = quantity
    existing.notes = cleanText(input.notes)
    existing.updatedAt = now
  } else {
    current.items.push({
      productId: input.productId,
      quantity,
      notes: cleanText(input.notes),
      addedAt: now,
      updatedAt: now,
    })
  }

  current.updatedAt = now
  carts[companyId] = current
  await writeCartsFile(carts)

  return getBuyCart(companyId)
}

export async function removeBuyCartItem(companyId: string, productId: string) {
  const carts = await readCartsFile()
  const current = carts[companyId] ?? emptyCart(companyId)

  current.items = current.items.filter((item) => item.productId !== productId)
  current.updatedAt = new Date().toISOString()

  carts[companyId] = current
  await writeCartsFile(carts)

  return getBuyCart(companyId)
}

export async function clearBuyCart(companyId: string) {
  const carts = await readCartsFile()
  carts[companyId] = emptyCart(companyId)
  await writeCartsFile(carts)
  return getBuyCart(companyId)
}

export async function confirmBuyCart(input: ConfirmCartInput) {
  const carts = await readCartsFile()
  const cart = carts[input.companyId] ?? emptyCart(input.companyId)

  if (cart.items.length === 0) throw new Error('BUY_CART_EMPTY')

  const request = await prisma.buyRequest.create({
    data: {
      companyId: input.companyId,
      eventDateId: input.eventDateId ?? cart.eventDateId ?? null,
      title: cleanText(input.title) ?? cart.title ?? 'Compra',
      supplierName: cleanText(input.supplierName) ?? cart.supplierName,
      notes: cleanText(input.notes) ?? cart.notes,
      status: 'pending',
      confirmedAt: new Date(),
      items: {
        create: cart.items.map((item) => ({
          productId: item.productId,
          requestedQuantity: item.quantity,
          notes: item.notes,
        })),
      },
    },
    include: buyRequestInclude,
  })

  carts[input.companyId] = emptyCart(input.companyId)
  await writeCartsFile(carts)

  return request
}

export async function listBuyRequests(companyId: string) {
  return prisma.buyRequest.findMany({
    where: { companyId },
    include: buyRequestInclude,
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function getBuyRequest(companyId: string, id: string) {
  const request = await prisma.buyRequest.findFirst({
    where: {
      id,
      companyId,
    },
    include: buyRequestInclude,
  })

  if (!request) throw new Error('BUY_REQUEST_NOT_FOUND')

  return request
}

export async function createBuyRequest(input: ConfirmCartInput & { items: CartItemInput[] }) {
  if (!input.items.length) throw new Error('BUY_REQUEST_EMPTY')

  return prisma.buyRequest.create({
    data: {
      companyId: input.companyId,
      eventDateId: input.eventDateId ?? null,
      title: cleanText(input.title) ?? 'Compra',
      supplierName: cleanText(input.supplierName),
      notes: cleanText(input.notes),
      status: 'pending',
      confirmedAt: new Date(),
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          requestedQuantity: asPositiveNumber(item.quantity),
          notes: cleanText(item.notes),
        })),
      },
    },
    include: buyRequestInclude,
  })
}

export async function cancelBuyRequest(companyId: string, id: string) {
  const existing = await getBuyRequest(companyId, id)

  if (existing.status === 'received') {
    throw new Error('BUY_REQUEST_ALREADY_RECEIVED')
  }

  return prisma.buyRequest.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
    },
    include: buyRequestInclude,
  })
}

export async function receiveBuyRequest(input: ReceiveBuyRequestInput) {
  const existing = await getBuyRequest(input.companyId, input.buyRequestId)

  if (existing.status === 'cancelled') throw new Error('BUY_REQUEST_CANCELLED')
  if (existing.status === 'received') throw new Error('BUY_REQUEST_ALREADY_RECEIVED')

  const itemsById = new Map(existing.items.map((item) => [item.id, item]))

  return prisma.$transaction(async (tx) => {
    let boughtCount = 0
    let notBoughtCount = 0

    for (const itemInput of input.items) {
      const existingItem = itemsById.get(itemInput.itemId)
      if (!existingItem) continue

      const boughtQuantity = asPositiveNumber(itemInput.boughtQuantity)
      const unitPriceDecimal = asDecimalOrNull(itemInput.unitPrice)
      const totalPriceDecimal =
        asDecimalOrNull(itemInput.totalPrice) ??
        (unitPriceDecimal
          ? unitPriceDecimal.mul(new Prisma.Decimal(boughtQuantity))
          : null)

      const totalPrice = Number(totalPriceDecimal ?? 0)
      const requestedQuantity = Number(existingItem.requestedQuantity ?? 0)

      const status: BuyRequestItemStatus =
        itemInput.status ??
        (boughtQuantity <= 0
          ? 'not_bought'
          : boughtQuantity < requestedQuantity
            ? 'partial'
            : 'bought')

      if (status === 'not_bought' || boughtQuantity <= 0) {
        notBoughtCount += 1
      } else {
        boughtCount += 1
      }

      await tx.buyRequestItem.update({
        where: { id: existingItem.id },
        data: {
          boughtQuantity,
          unitPrice: unitPriceDecimal,
          totalPrice: totalPriceDecimal,
          status,
          notes: cleanText(itemInput.notes),
        },
      })

      if (boughtQuantity > 0 && totalPrice > 0) {
        await updateStockAndCostForBoughtItem({
          tx,
          companyId: input.companyId,
          productId: existingItem.productId,
          boughtQuantity,
          totalPaid: totalPrice,
          buyRequestId: existing.id,
        })
      }
    }

    const status: BuyRequestStatus =
      boughtCount > 0 && notBoughtCount > 0
        ? 'partially_received'
        : boughtCount > 0
          ? 'received'
          : 'cancelled'

    return tx.buyRequest.update({
      where: { id: existing.id },
      data: {
        status,
        receivedAt: new Date(),
      },
      include: buyRequestInclude,
    })
  })
}


function formatChecklistQuantity(value: number | string | null | undefined, unit?: string | null) {
  const formatted = Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  if (!unit || unit === 'unit') return formatted
  return `${formatted} ${unit}`
}

function buildShoppingListText(request: Awaited<ReturnType<typeof getBuyRequest>>) {
  const lines: string[] = []

  lines.push('*** LISTA DE COMPRAS ***')
  lines.push(request.title?.trim() || 'Compra')

  if (request.supplierName?.trim()) {
    lines.push(`LOCAL: ${request.supplierName.trim()}`)
  }

  lines.push(new Date().toLocaleString('pt-BR'))
  lines.push('--------------------------')

  for (const item of request.items) {
    const quantity = formatChecklistQuantity(
      Number(item.requestedQuantity ?? 0),
      item.product.stockUnit ?? 'unit'
    )

    lines.push(`[ ] ${quantity} ${item.product.name}`)
  }

  lines.push('--------------------------')
  lines.push('')
  lines.push('')
  lines.push('')

  return lines.join('\n')
}

export async function printBuyRequestShoppingList(companyId: string, id: string) {
  const request = await getBuyRequest(companyId, id)

  if (request.status !== 'pending') {
    throw new Error('ONLY_PENDING_BUY_REQUESTS_CAN_BE_PRINTED')
  }

  if (!request.items.length) {
    throw new Error('BUY_REQUEST_HAS_NO_ITEMS')
  }

  const printerName = await getSelectedOrderPrinterName()

  if (!printerName) {
    throw new Error('ORDER_PRINTER_NOT_CONFIGURED')
  }

  await printRawThermalText(buildShoppingListText(request), {
    printerName,
    feedLines: 6,
    cut: true,
  })

  return { ok: true }
}
