import { OrderStatus, Prisma, PaymentMethod } from '@prisma/client'
import PDFDocument from 'pdfkit'
import { prisma } from '../lib/prisma'
import { printOrderTickets } from './printer.service'
import { createAuditLog } from './audit.service'

type CreateOrderVariationOptionInput = {
  optionId: string
  priceModifier: Prisma.Decimal | number | string
}

type CreateOrderVariationSelectionInput = {
  groupId: string
  options: CreateOrderVariationOptionInput[]
}

type CreateOrderItemInput = {
  productId: string
  quantity: number
  unitPrice: Prisma.Decimal | number | string
  totalPrice: Prisma.Decimal | number | string
  notes?: string | null
  variations?: CreateOrderVariationSelectionInput[]
}

type CreateOrderInput = {
  id: string
  companyId: string
  internalCustomerId?: string | null
  eventDateId?: string | null
  customerId?: string | null
  comanda: number
  comandaName?: string | null
  observation?: string | null
  createdAt?: Date
  paidAt?: Date | null
  status: OrderStatus
  total: Prisma.Decimal | number | string
  paymentMethod?: PaymentMethod | null
  taxApplied: boolean
  orderItems: CreateOrderItemInput[]
}

function normalizeToBaseUnit(
  quantity: number,
  unit: string | null | undefined
): number {
  if (!Number.isFinite(quantity)) return quantity

  switch (unit) {
    case 'l':
      return quantity * 1000
    case 'kg':
      return quantity * 1000
    case 'ml':
    case 'g':
    case 'unit':
    default:
      return quantity
  }
}

function getUnitFamily(unit: string | null | undefined) {
  if (unit === 'ml' || unit === 'l') return 'volume'
  if (unit === 'g' || unit === 'kg') return 'weight'
  return 'count'
}

function getUnitContentQuantity(product: any): number | null {
  const quantity = Number(product?.unitContentQuantity ?? 0)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

function getUnitContentUnit(product: any): string | null {
  const unit = product?.unitContentUnit ?? null
  return unit && unit !== 'unit' ? unit : null
}

function hasUnitContent(product: any) {
  return (
    (product?.stockUnit ?? 'unit') === 'unit' &&
    getUnitContentQuantity(product) != null &&
    getUnitContentUnit(product) != null
  )
}

function getEffectiveStockUnit(product: any, fallbackUnit?: string | null) {
  if (hasUnitContent(product)) {
    return getUnitContentUnit(product) ?? fallbackUnit ?? 'unit'
  }

  return product?.stockUnit ?? fallbackUnit ?? 'unit'
}

function getStockBaseQuantity(product: any, fallbackUnit?: string | null) {
  const stockQuantity = Number(product?.stockQuantity ?? 0)

  if (!Number.isFinite(stockQuantity)) return stockQuantity

  if (hasUnitContent(product)) {
    const contentQuantity = getUnitContentQuantity(product) ?? 0
    const contentUnit = getUnitContentUnit(product) ?? fallbackUnit ?? 'unit'

    return normalizeToBaseUnit(stockQuantity * contentQuantity, contentUnit)
  }

  return normalizeToBaseUnit(
    stockQuantity,
    product?.stockUnit ?? fallbackUnit ?? 'unit'
  )
}

function convertBaseQuantityBackToStoredStock(
  baseQuantity: number,
  product: any,
  fallbackUnit?: string | null
) {
  if (hasUnitContent(product)) {
    const contentQuantity = getUnitContentQuantity(product) ?? 1
    const contentUnit = getUnitContentUnit(product) ?? fallbackUnit ?? 'unit'
    const contentBaseQuantity = normalizeToBaseUnit(contentQuantity, contentUnit)

    if (!Number.isFinite(contentBaseQuantity) || contentBaseQuantity <= 0) {
      return baseQuantity
    }

    return baseQuantity / contentBaseQuantity
  }

  const stockUnit = product?.stockUnit ?? fallbackUnit ?? 'unit'

  if (stockUnit === 'l' || stockUnit === 'kg') {
    return baseQuantity / 1000
  }

  return baseQuantity
}

async function decrementIngredientStock(
  tx: any,
  ingredientProductId: string,
  quantity: number,
  unit: string | null | undefined
) {
  const ingredient = await tx.product.findUnique({
    where: { id: ingredientProductId },
    select: {
      id: true,
      stockQuantity: true,
      stockUnit: true,
      trackStock: true,
      unlimitedStock: true,
      madeOnDemand: true,
      unitContentQuantity: true,
      unitContentUnit: true,
    },
  })

  if (!ingredient) return
  if (!ingredient.trackStock || ingredient.unlimitedStock) return

  const effectiveStockUnit = getEffectiveStockUnit(ingredient, unit)

  if (getUnitFamily(unit) !== getUnitFamily(effectiveStockUnit)) {
    console.warn('Stock unit mismatch while decrementing ingredient stock', {
      ingredientProductId,
      requestedQuantity: quantity,
      requestedUnit: unit,
      stockUnit: ingredient.stockUnit,
      effectiveStockUnit,
      unitContentQuantity: ingredient.unitContentQuantity,
      unitContentUnit: ingredient.unitContentUnit,
    })

    return
  }

  const decrementInBase = normalizeToBaseUnit(quantity, unit)
  const currentStockBase = getStockBaseQuantity(ingredient, unit)

  if (
    !Number.isFinite(decrementInBase) ||
    decrementInBase <= 0 ||
    !Number.isFinite(currentStockBase)
  ) {
    return
  }

  const nextStockBase = currentStockBase - decrementInBase

  const nextStockQuantity = convertBaseQuantityBackToStoredStock(
    nextStockBase,
    ingredient,
    unit
  )

  await tx.product.update({
    where: { id: ingredientProductId },
    data: {
      stockQuantity: new Prisma.Decimal(nextStockQuantity),
    },
  })
}

async function consumeProductRecipe(
  tx: any,
  productId: string,
  requiredBaseQuantity: number,
  requiredBaseUnit?: string | null
) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: {
      recipeItems: true,
    },
  })

  if (!product) return

  const recipeItems = product.recipeItems ?? []
  const hasRecipe = recipeItems.length > 0
  const outputQuantity = Number(product.recipeOutputQuantity ?? 1)
  const outputUnit =
    product.recipeOutputUnit ??
    getEffectiveStockUnit(product, requiredBaseUnit) ??
    'unit'

  const outputBaseQuantity = normalizeToBaseUnit(outputQuantity, outputUnit)

  if (
    product.madeOnDemand &&
    hasRecipe &&
    Number.isFinite(outputBaseQuantity) &&
    outputBaseQuantity > 0
  ) {
    const recipeFactor = requiredBaseQuantity / outputBaseQuantity

    for (const recipeItem of recipeItems) {
      const nestedRequired = Number(recipeItem.quantity ?? 0) * recipeFactor
      if (!Number.isFinite(nestedRequired) || nestedRequired <= 0) continue

      const nestedBaseQuantity = normalizeToBaseUnit(
        nestedRequired,
        recipeItem.unit
      )

      await consumeProductRecipe(
        tx,
        recipeItem.ingredientProductId,
        nestedBaseQuantity,
        recipeItem.unit
      )
    }

    return
  }

  const stockUnit = getEffectiveStockUnit(product, requiredBaseUnit)

  const storedQuantityToDecrement =
    stockUnit === 'l' || stockUnit === 'kg'
      ? requiredBaseQuantity / 1000
      : requiredBaseQuantity

  await decrementIngredientStock(
    tx,
    productId,
    storedQuantityToDecrement,
    stockUnit
  )
}


async function incrementIngredientStock(params: {
  tx: any
  companyId: string
  userId?: string | null
  productId: string
  quantity: number
  unit: string | null | undefined
  reason: string
}) {
  const { tx, companyId, userId, productId, quantity, unit, reason } = params

  const product = await tx.product.findFirst({
    where: {
      id: productId,
      companyId,
    },
    select: {
      id: true,
      stockQuantity: true,
      stockUnit: true,
      trackStock: true,
      unlimitedStock: true,
      unitContentQuantity: true,
      unitContentUnit: true,
    },
  })

  if (!product) return
  if (!product.trackStock || product.unlimitedStock) return

  const effectiveStockUnit = getEffectiveStockUnit(product, unit)

  if (getUnitFamily(unit) !== getUnitFamily(effectiveStockUnit)) {
    console.warn('Stock unit mismatch while incrementing ingredient stock', {
      productId,
      requestedQuantity: quantity,
      requestedUnit: unit,
      stockUnit: product.stockUnit,
      effectiveStockUnit,
      unitContentQuantity: product.unitContentQuantity,
      unitContentUnit: product.unitContentUnit,
    })

    return
  }

  const incrementInBase = normalizeToBaseUnit(quantity, unit)
  const currentStockBase = getStockBaseQuantity(product, unit)

  if (
    !Number.isFinite(incrementInBase) ||
    incrementInBase <= 0 ||
    !Number.isFinite(currentStockBase)
  ) {
    return
  }

  const nextStockBase = currentStockBase + incrementInBase

  const nextStockQuantity = convertBaseQuantityBackToStoredStock(
    nextStockBase,
    product,
    unit
  )

  const previousQty = Number(product.stockQuantity ?? 0)

  await tx.product.update({
    where: { id: product.id },
    data: {
      stockQuantity: new Prisma.Decimal(nextStockQuantity),
      updatedByUserId: userId ?? undefined,
    },
  })

  await tx.stockMovement.create({
    data: {
      companyId,
      productId: product.id,
      type: 'in',
      quantity,
      previousQty,
      newQty: nextStockQuantity,
      reason,
      performedByUserId: userId ?? null,
    },
  })
}

async function restoreProductRecipe(params: {
  tx: any
  companyId: string
  userId?: string | null
  productId: string
  requiredBaseQuantity: number
  requiredBaseUnit?: string | null
  reason: string
}) {
  const {
    tx,
    companyId,
    userId,
    productId,
    requiredBaseQuantity,
    requiredBaseUnit,
    reason,
  } = params

  const product = await tx.product.findFirst({
    where: {
      id: productId,
      companyId,
    },
    include: {
      recipeItems: true,
    },
  })

  if (!product) return

  const recipeItems = product.recipeItems ?? []
  const hasRecipe = recipeItems.length > 0
  const outputQuantity = Number(product.recipeOutputQuantity ?? 1)
  const outputUnit =
    product.recipeOutputUnit ??
    getEffectiveStockUnit(product, requiredBaseUnit) ??
    'unit'

  const outputBaseQuantity = normalizeToBaseUnit(outputQuantity, outputUnit)

  if (
    product.madeOnDemand &&
    hasRecipe &&
    Number.isFinite(outputBaseQuantity) &&
    outputBaseQuantity > 0
  ) {
    const recipeFactor = requiredBaseQuantity / outputBaseQuantity

    for (const recipeItem of recipeItems) {
      const nestedRequired = Number(recipeItem.quantity ?? 0) * recipeFactor
      if (!Number.isFinite(nestedRequired) || nestedRequired <= 0) continue

      const nestedBaseQuantity = normalizeToBaseUnit(
        nestedRequired,
        recipeItem.unit
      )

      await restoreProductRecipe({
        tx,
        companyId,
        userId,
        productId: recipeItem.ingredientProductId,
        requiredBaseQuantity: nestedBaseQuantity,
        requiredBaseUnit: recipeItem.unit,
        reason,
      })
    }

    return
  }

  const stockUnit = getEffectiveStockUnit(product, requiredBaseUnit)

  const stockQuantity =
    stockUnit === 'l' || stockUnit === 'kg'
      ? requiredBaseQuantity / 1000
      : requiredBaseQuantity

  await incrementIngredientStock({
    tx,
    companyId,
    userId,
    productId,
    quantity: stockQuantity,
    unit: stockUnit,
    reason,
  })
}

async function restockOrder(params: {
  tx: any
  orderId: string
  companyId: string
  userId?: string | null
}) {
  const { tx, orderId, companyId, userId } = params

  const order = await tx.order.findFirst({
    where: {
      id: orderId,
      companyId,
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              recipeItems: true,
            },
          },
          variations: {
            include: {
              options: {
                include: {
                  option: {
                    include: {
                      recipeItems: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!order) return

  for (const item of order.items) {
    const itemQuantity = Number(item.quantity ?? 0)
    if (itemQuantity <= 0) continue

    const productOutputQuantity = Number(item.product.recipeOutputQuantity ?? 1)
    const productOutputUnit = item.product.recipeOutputUnit ?? item.product.stockUnit ?? 'unit'
    const productOutputBase = normalizeToBaseUnit(productOutputQuantity, productOutputUnit)
    const soldProductBase = itemQuantity * productOutputBase
    const reason = `Cancelamento do pedido ${order.id}`

    if (item.product.madeOnDemand && (item.product.recipeItems?.length ?? 0) > 0) {
      await restoreProductRecipe({
        tx,
        companyId,
        userId,
        productId: item.productId,
        requiredBaseQuantity: soldProductBase,
        requiredBaseUnit: productOutputUnit,
        reason,
      })
    } else if (item.product.trackStock && !item.product.unlimitedStock) {
      await incrementIngredientStock({
        tx,
        companyId,
        userId,
        productId: item.productId,
        quantity: itemQuantity,
        unit: item.product.stockUnit ?? 'unit',
        reason,
      })
    }

    for (const variation of item.variations ?? []) {
      for (const selected of variation.options ?? []) {
        for (const recipeItem of selected.option.recipeItems ?? []) {
          const usedQuantity = Number(recipeItem.quantity ?? 0) * itemQuantity
          if (usedQuantity <= 0) continue

          const usedBase = normalizeToBaseUnit(usedQuantity, recipeItem.unit)

          await restoreProductRecipe({
            tx,
            companyId,
            userId,
            productId: recipeItem.ingredientProductId,
            requiredBaseQuantity: usedBase,
            requiredBaseUnit: recipeItem.unit,
            reason: `Cancelamento do pedido ${order.id} - variação ${selected.option.name}`,
          })
        }
      }
    }
  }
}

async function applyStockFromOrder(
  tx: any,
  orderId: string,
  companyId: string
) {
  const order = await tx.order.findFirst({
    where: {
      id: orderId,
      companyId,
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              recipeItems: true,
            },
          },
          variations: {
            include: {
              options: {
                include: {
                  option: {
                    include: {
                      recipeItems: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!order) return

  for (const item of order.items) {
    const itemQuantity = Number(item.quantity ?? 0)
    if (itemQuantity <= 0) continue

    const productOutputQuantity = Number(item.product.recipeOutputQuantity ?? 1)
    const productOutputUnit = item.product.recipeOutputUnit ?? item.product.stockUnit ?? 'unit'
    const productOutputBase = normalizeToBaseUnit(productOutputQuantity, productOutputUnit)
    const soldProductBase = itemQuantity * productOutputBase

    if (item.product.madeOnDemand && (item.product.recipeItems?.length ?? 0) > 0) {
      await consumeProductRecipe(
        tx,
        item.productId,
        soldProductBase,
        productOutputUnit
      )
    } else if (item.product.trackStock && !item.product.unlimitedStock) {
      const directUnit = item.product.stockUnit ?? 'unit'
      const directQuantity = itemQuantity
      await decrementIngredientStock(tx, item.productId, directQuantity, directUnit)
    }

    for (const variation of item.variations ?? []) {
      for (const selected of variation.options ?? []) {
        for (const recipeItem of selected.option.recipeItems ?? []) {
          const usedQuantity = Number(recipeItem.quantity ?? 0) * itemQuantity
          if (usedQuantity <= 0) continue

          const usedBase = normalizeToBaseUnit(usedQuantity, recipeItem.unit)

          await consumeProductRecipe(
            tx,
            recipeItem.ingredientProductId,
            usedBase,
            recipeItem.unit
          )
        }
      }
    }
  }
}

export async function paySelectedInternalCustomerOrders(
  input: {
    companyId: string
    internalCustomerId: string
    paymentMethod: 'money' | 'pix' | 'credit' | 'debit'
    taxApplied: boolean
    orderIds: string[]
    userId: string
  }
) {
  if (!input.orderIds.length) {
    throw new Error('ORDER_IDS_REQUIRED')
  }

  const pendingOrders = await prisma.order.findMany({
    where: {
      companyId: input.companyId,
      internalCustomerId: input.internalCustomerId,
      status: 'pending',
      id: { in: input.orderIds },
    },
    select: { id: true },
  })

  if (!pendingOrders.length) {
    return { ok: true, paidCount: 0 }
  }

  const paidAt = new Date()

  await prisma.$transaction(async (tx: any) => {
    await tx.order.updateMany({
      where: {
        companyId: input.companyId,
        internalCustomerId: input.internalCustomerId,
        status: 'pending',
        id: { in: input.orderIds },
      },
      data: {
        status: 'paid',
        paymentMethod: input.paymentMethod,
        taxApplied: input.taxApplied,
        paidAt,
      },
    })

    for (const order of pendingOrders) {
      await createAuditLog(tx, {
        companyId: input.companyId,
        userId: input.userId,
        entityType: 'Order',
        entityId: order.id,
        action: 'ORDER_PAID',
        newValues: {
          status: 'paid',
          paymentMethod: input.paymentMethod,
          taxApplied: input.taxApplied,
          paidAt,
        },
      })
    }
  })

  return { ok: true, paidCount: pendingOrders.length }
}

export async function createOrder(data: CreateOrderInput, userId: string) {
  if (!data.companyId?.trim()) {
    throw new Error('ORDER_COMPANY_ID_REQUIRED')
  }

  if (data.comanda == null) {
    throw new Error('ORDER_COMANDA_REQUIRED')
  }

  if (!Array.isArray(data.orderItems) || data.orderItems.length === 0) {
    throw new Error('ORDER_ITEMS_REQUIRED')
  }

  if (data.eventDateId) {
    const eventDate = await prisma.eventDate.findFirst({
      where: {
        id: data.eventDateId,
        companyId: data.companyId,
      },
      select: {
        id: true,
      },
    })

    if (!eventDate) {
      throw new Error('EVENT_DATE_NOT_FOUND')
    }
  }

  let resolvedCustomerId = data.customerId ?? null
  let resolvedComandaName = data.comandaName?.trim() || null

  if (resolvedCustomerId) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: resolvedCustomerId,
        companyId: data.companyId,
        active: true,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!customer) {
      throw new Error('CUSTOMER_NOT_FOUND')
    }

    resolvedComandaName = resolvedComandaName || customer.name
  }

  if (!resolvedCustomerId && data.eventDateId && data.comanda != null) {
    const eventComanda = await prisma.eventCustomerComanda.findFirst({
      where: {
        companyId: data.companyId,
        eventDateId: data.eventDateId,
        comandaNumber: data.comanda,
      },
      include: {
        customer: true,
      },
    })

    if (eventComanda?.customer?.active) {
      resolvedCustomerId = eventComanda.customerId
      resolvedComandaName =
        resolvedComandaName || eventComanda.comandaName || eventComanda.customer.name
    }
  }

  const validPaymentMethods: PaymentMethod[] = ['money', 'pix', 'credit', 'debit']

  if (data.status === 'paid') {
    if (!data.paymentMethod || !validPaymentMethods.includes(data.paymentMethod)) {
      throw new Error('ORDER_PAYMENT_METHOD_REQUIRED')
    }
  }

  if (data.internalCustomerId) {
    const internalCustomer = await prisma.internalCustomer.findUnique({
      where: {
        id: data.internalCustomerId,
      },
      select: {
        id: true,
        active: true,
      },
    })

    if (!internalCustomer) {
      throw new Error('INTERNAL_CUSTOMER_NOT_FOUND')
    }

    if (!internalCustomer.active) {
      throw new Error('INTERNAL_CUSTOMER_DISABLED')
    }
  }

  await assertInternalCustomerCanReceiveOrder(data.internalCustomerId)

  const order = await prisma.$transaction(async (tx: any) => {
    const createdOrder = await tx.order.create({
      data: {
        id: data.id,
        companyId: data.companyId,
        internalCustomerId: data.internalCustomerId ?? null,
        eventDateId: data.eventDateId ?? null,
        customerId: resolvedCustomerId,
        comanda: data.comanda,
        comandaName: resolvedComandaName,
        observation: data.observation?.trim() || null,
        createdAt: data.createdAt,
        paidAt: data.paidAt ?? null,
        status: data.status,
        total: new Prisma.Decimal(data.total),
        paymentMethod: data.paymentMethod ?? null,
        taxApplied: data.taxApplied,
        createdByUserId: userId,

        items: {
          create: data.orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            totalPrice: new Prisma.Decimal(item.totalPrice),
            notes: item.notes ?? null,
            variations: item.variations?.length
              ? {
                create: item.variations.map((variation) => ({
                  groupId: variation.groupId,
                  options: variation.options?.length
                    ? {
                      create: variation.options.map((option) => ({
                        optionId: option.optionId,
                        priceModifier: new Prisma.Decimal(option.priceModifier),
                      })),
                    }
                    : undefined,
                })),
              }
              : undefined,
          })),
        },
      },
      include: {
        company: true,
        internalCustomer: true,
        customer: true,
        eventDate: true,
        items: {
          include: {
            product: {
              include: {
                variationGroups: {
                  orderBy: {
                    sortOrder: 'asc',
                  },
                  include: {
                    options: {
                      where: {
                        active: true,
                      },
                      orderBy: {
                        sortOrder: 'asc',
                      },
                    },
                  },
                },
              },
            },
            variations: {
              include: {
                group: true,
                options: {
                  include: {
                    option: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    const shouldConsumeStock =
      data.status === 'paid' ||
      (data.status === 'pending' && Boolean(data.internalCustomerId))

    if (shouldConsumeStock) {
      await applyStockFromOrder(tx, createdOrder.id, data.companyId)
    }

    await createAuditLog(tx, {
      companyId: data.companyId,
      userId,
      entityType: 'Order',
      entityId: createdOrder.id,
      action: 'ORDER_CREATED',
      newValues: {
        comanda: createdOrder.comanda,
        comandaName: createdOrder.comandaName,
        customerId: createdOrder.customerId,
        eventDateId: createdOrder.eventDateId,
        total: createdOrder.total,
        status: createdOrder.status,
        paymentMethod: createdOrder.paymentMethod,
        taxApplied: createdOrder.taxApplied,
      },
    })

    return createdOrder
  })

  try {
    console.log('[ORDER PRINT] Starting print', {
      orderId: order.id,
      companyId: order.companyId,
      items: order.items.length,
      printerPayloadItems: order.items.map((item: (typeof order.items)[number]) => ({
        productName: item.product.name,
        quantity: item.quantity,
        variations: item.variations.length,
        observation: order.observation ?? null,
      })),
    })

    await printOrderTickets({
      companyId: order.companyId,
      id: order.id,
      comanda: order.comanda,
      comandaName: order.comandaName ?? null,
      observation: order.observation ?? null,
      createdAt: order.createdAt,
      status: order.status,
      internalCustomerName: order.internalCustomer?.name ?? null,
      items: order.items.map((item: (typeof order.items)[number]) => ({
        quantity: item.quantity,
        notes: item.notes,
        product: {
          name: item.product.name,
        },
        variations: item.variations.map(
          (variation: (typeof item.variations)[number]) => ({
            group: {
              name: variation.group.name,
            },
            options: variation.options.map(
              (opt: (typeof variation.options)[number]) => ({
                option: {
                  name: opt.option.name,
                },
              })
            ),
          })
        ),
      })),
    })

    console.log('[ORDER PRINT] Printed successfully', {
      orderId: order.id,
    })
  } catch (error: any) {
    console.error('[ORDER PRINT] Failed', {
      orderId: order.id,
      companyId: order.companyId,
      message: error?.message,
      stack: error?.stack,
      error,
    })

    throw error
  }

  return {
    ...order,
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    taxApplied: order.taxApplied,
  }
}

export async function getOrdersByCompany(companyId: string, includeCancelled = true) {
  const orders = await prisma.order.findMany({
    where: {
      companyId,
      ...(includeCancelled ? {} : { status: 'paid' }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      internalCustomer: true,
      customer: true,
      eventDate: true,
      items: {
        include: {
          product: {
            include: {
              variationGroups: {
                orderBy: {
                  sortOrder: 'asc',
                },
                include: {
                  options: {
                    where: {
                      active: true,
                    },
                    orderBy: {
                      sortOrder: 'asc',
                    },
                  },
                },
              },
            },
          },
          variations: {
            include: {
              group: true,
              options: {
                include: {
                  option: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return orders.map((order) => ({
    ...order,
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    taxApplied: order.taxApplied,
    items: order.items.map((item) => ({
      product: {
        ...item.product,
        price: Number(item.product.price),
        variationGroups: (item.product.variationGroups ?? []).map((group) => ({
          ...group,
          options: (group.options ?? []).map((option) => ({
            ...option,
            priceModifier: Number(option.priceModifier),
          })),
        })),
      },
      quantity: item.quantity,
      variationSelections: item.variations.map((variation) => ({
        groupId: variation.groupId,
        selectedOptionIds: variation.options.map((option) => option.optionId),
      })),
    })),
  }))
}

export async function cancelOrder(orderId: string, companyId: string, userId: string) {
  const existingOrder = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId,
    },
  })

  if (!existingOrder) {
    throw new Error('ORDER_NOT_FOUND')
  }

  if (existingOrder.status === 'cancelled') {
    throw new Error('ORDER_ALREADY_CANCELLED')
  }

  const cancelledAt = new Date()

  const order = await prisma.$transaction(async (tx) => {
    const shouldRestock =
      existingOrder.status === 'paid' ||
      (existingOrder.status === 'pending' && Boolean(existingOrder.internalCustomerId))

    if (shouldRestock) {
      await restockOrder({
        tx,
        orderId,
        companyId,
        userId,
      })
    }

    const updated = await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: 'cancelled',
        cancelledAt,
        cancelledByUserId: userId,
      },
    })

    await createAuditLog(tx, {
      companyId,
      userId,
      entityType: 'Order',
      entityId: orderId,
      action: 'ORDER_CANCELLED',
      oldValues: {
        status: existingOrder.status,
      },
      newValues: {
        status: 'cancelled',
        cancelledAt,
        restocked: shouldRestock,
      },
    })

    return updated
  })

  return {
    ...order,
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    taxApplied: order.taxApplied,
  }
}

export async function getInternalCustomerPendingOrders(
  companyId: string,
  internalCustomerId: string
) {
  const customer = await prisma.internalCustomer.findFirst({
    where: {
      id: internalCustomerId,
      companyId,
      active: true,
    },
  })

  if (!customer) {
    throw new Error('INTERNAL_CUSTOMER_NOT_FOUND')
  }

  const orders = await prisma.order.findMany({
    where: {
      companyId,
      internalCustomerId,
      status: 'pending',
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              variationGroups: {
                orderBy: {
                  sortOrder: 'asc',
                },
                include: {
                  options: {
                    where: {
                      active: true,
                    },
                    orderBy: {
                      sortOrder: 'asc',
                    },
                  },
                },
              },
            },
          },
          variations: {
            include: {
              group: true,
              options: {
                include: {
                  option: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const normalizedOrders = orders.map((order) => ({
    ...order,
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    taxApplied: order.taxApplied,
    items: order.items.map((item) => ({
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      product: {
        ...item.product,
        price: Number(item.product.price),
        variationGroups: (item.product.variationGroups ?? []).map((group) => ({
          ...group,
          options: (group.options ?? []).map((option) => ({
            ...option,
            priceModifier: Number(option.priceModifier),
          })),
        })),
      },
      quantity: item.quantity,
      variationSelections: item.variations.map((variation) => ({
        groupId: variation.groupId,
        selectedOptionIds: variation.options.map((option) => option.optionId),
      })),
    })),
  }))

  return {
    customer,
    orders: normalizedOrders,
    summary: {
      pendingCount: normalizedOrders.length,
      pendingTotal: normalizedOrders.reduce((sum, order) => sum + Number(order.total), 0),
    },
  }
}

export async function getInternalCustomerTodayOrders(
  companyId: string,
  internalCustomerId: string
) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const customer = await prisma.internalCustomer.findFirst({
    where: {
      id: internalCustomerId,
      companyId,
      active: true,
    },
  })

  if (!customer) {
    throw new Error('INTERNAL_CUSTOMER_NOT_FOUND')
  }

  const orders = await prisma.order.findMany({
    where: {
      companyId,
      internalCustomerId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              variationGroups: {
                orderBy: {
                  sortOrder: 'asc',
                },
                include: {
                  options: {
                    where: {
                      active: true,
                    },
                    orderBy: {
                      sortOrder: 'asc',
                    },
                  },
                },
              },
            },
          },
          variations: {
            include: {
              group: true,
              options: {
                include: {
                  option: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const normalizedOrders = orders.map((order) => ({
    ...order,
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    taxApplied: order.taxApplied,
    items: order.items.map((item) => ({
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      product: {
        ...item.product,
        price: Number(item.product.price),
        variationGroups: (item.product.variationGroups ?? []).map((group) => ({
          ...group,
          options: (group.options ?? []).map((option) => ({
            ...option,
            priceModifier: Number(option.priceModifier),
          })),
        })),
      },
      quantity: item.quantity,
      variationSelections: item.variations.map((variation) => ({
        groupId: variation.groupId,
        selectedOptionIds: variation.options.map((option) => option.optionId),
      })),
    })),
  }))

  const pendingOrders = normalizedOrders.filter((order) => order.status === 'pending')
  const pendingTotal = pendingOrders.reduce((sum, order) => sum + Number(order.total), 0)

  return {
    customer,
    orders: normalizedOrders,
    pendingOrders,
    summary: {
      pendingCount: pendingOrders.length,
      pendingTotal,
    },
  }
}

export async function payInternalCustomerTodayOrders(
  input: {
    companyId: string
    internalCustomerId: string
    paymentMethod: 'money' | 'pix' | 'credit' | 'debit'
    taxApplied: boolean
    userId: string
  }
) {
  const pendingOrders = await prisma.order.findMany({
    where: {
      companyId: input.companyId,
      internalCustomerId: input.internalCustomerId,
      status: 'pending',
    },
    select: { id: true },
  })

  if (!pendingOrders.length) {
    return { ok: true, paidCount: 0 }
  }

  const paidAt = new Date()

  await prisma.$transaction(async (tx: any) => {
    await tx.order.updateMany({
      where: {
        companyId: input.companyId,
        internalCustomerId: input.internalCustomerId,
        status: 'pending',
      },
      data: {
        status: 'paid',
        paymentMethod: input.paymentMethod,
        taxApplied: input.taxApplied,
        paidAt,
      },
    })

    for (const order of pendingOrders) {
      await createAuditLog(tx, {
        companyId: input.companyId,
        userId: input.userId,
        entityType: 'Order',
        entityId: order.id,
        action: 'ORDER_PAID',
        newValues: {
          status: 'paid',
          paymentMethod: input.paymentMethod,
          taxApplied: input.taxApplied,
          paidAt,
        },
      })
    }
  })

  return { ok: true, paidCount: pendingOrders.length }
}

export async function generateOrdersReportPdf(companyId: string): Promise<Buffer> {
  const orders = await prisma.order.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: {
      company: true,
      internalCustomer: true,
      items: {
        include: {
          product: true,
          variations: {
            include: {
              group: true,
              options: {
                include: {
                  option: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
  })

  const chunks: Buffer[] = []

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const companyName = orders[0]?.company?.name || 'Empresa'
    const generatedAt = new Date().toLocaleString('pt-BR')

    doc.fontSize(20).text('Relatório de Pedidos')
    doc.moveDown(0.3)
    doc.fontSize(11).fillColor('#666666').text(`Empresa: ${companyName}`)
    doc.text(`Gerado em: ${generatedAt}`)
    doc.text(`Total de pedidos: ${orders.length}`)
    doc.fillColor('#000000')
    doc.moveDown()

    if (orders.length === 0) {
      doc.fontSize(12).text('Nenhum pedido encontrado.')
      doc.end()
      return
    }

    for (const order of orders) {
      if (doc.y > 700) {
        doc.addPage()
      }

      doc.fontSize(13).text(`Pedido #${order.id}`, { underline: true })
      doc.fontSize(10)
      doc.text(`Comanda: ${order.comanda}`)
      if (order.internalCustomer) {
        doc.text(`Cliente interno: ${order.internalCustomer.name}`)
      }
      doc.text(`Pagamento: ${order.paymentMethod ?? '-'}`)
      doc.text(`Taxa aplicada: ${order.taxApplied ? 'Sim' : 'Não'}`)
      doc.text(`Status: ${order.status}`)
      doc.text(`Criado em: ${new Date(order.createdAt).toLocaleString('pt-BR')}`)
      doc.text(`Total: R$ ${Number(order.total).toFixed(2)}`)
      if (order.paidAt) {
        doc.text(`Pago em: ${new Date(order.paidAt).toLocaleString('pt-BR')}`)
      }

      doc.moveDown(0.4)

      for (const item of order.items) {
        doc.fontSize(10).text(
          `• ${item.quantity}x ${item.product.name} | Unitário: R$ ${Number(item.unitPrice).toFixed(2)} | Total: R$ ${Number(item.totalPrice).toFixed(2)}`
        )

        if (item.notes) {
          doc.fontSize(9).fillColor('#666666').text(`  Obs: ${item.notes}`)
          doc.fillColor('#000000')
        }

        for (const variation of item.variations) {
          for (const option of variation.options) {
            doc
              .fontSize(9)
              .fillColor('#666666')
              .text(
                `  - ${variation.group.name}: ${option.option.name} (${Number(option.priceModifier) >= 0 ? '+' : ''}R$ ${Number(option.priceModifier).toFixed(2)})`
              )
            doc.fillColor('#000000')
          }
        }

        doc.moveDown(0.2)
      }

      doc.moveDown()
      doc.strokeColor('#cccccc')
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown()
    }

    doc.end()
  })
}

export async function getOrdersReportSummary(
  companyId: string,
  fromDate?: string,
  toDate?: string
) {
  let createdAtFilter: Prisma.DateTimeFilter | undefined

  const hasFrom = !!fromDate
  const hasTo = !!toDate

  if (hasFrom || hasTo) {
    createdAtFilter = {}

    if (fromDate) {
      const [year, month, day] = fromDate.split('-').map(Number)
      createdAtFilter.gte = new Date(year, month - 1, day, 0, 0, 0, 0)
    }

    if (toDate) {
      const [year, month, day] = toDate.split('-').map(Number)
      createdAtFilter.lte = new Date(year, month - 1, day, 23, 59, 59, 999)
    }
  }

  const orders = await prisma.order.findMany({
    where: {
      companyId,
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      internalCustomer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  const totalOrders = orders.length
  const grossRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0)
  const totalItemsSold = orders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  )

  const averageTicket = totalOrders > 0 ? grossRevenue / totalOrders : 0

  const statusCounts = {
    pending: orders.filter((o) => o.status === 'pending').length,
    paid: orders.filter((o) => o.status === 'paid').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  }

  const paymentMethodTotals = {
    money: 0,
    pix: 0,
    credit: 0,
    debit: 0,
    unknown: 0,
  }

  const productMap = new Map<
    string,
    {
      productId: string
      name: string
      quantity: number
      revenue: number
    }
  >()

  for (const order of orders) {
    const total = Number(order.total)

    switch (order.paymentMethod) {
      case 'money':
        paymentMethodTotals.money += total
        break
      case 'pix':
        paymentMethodTotals.pix += total
        break
      case 'credit':
        paymentMethodTotals.credit += total
        break
      case 'debit':
        paymentMethodTotals.debit += total
        break
      default:
        paymentMethodTotals.unknown += total
        break
    }

    for (const item of order.items) {
      const existing = productMap.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        quantity: 0,
        revenue: 0,
      }

      existing.quantity += item.quantity
      existing.revenue += Number(item.totalPrice)

      productMap.set(item.productId, existing)
    }
  }

  const topProducts = [...productMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)

  const salesByDayMap = new Map<
    string,
    {
      date: string
      total: number
      orders: number
    }
  >()

  for (const order of orders) {
    const date = new Date(order.createdAt).toISOString().slice(0, 10)
    const existing = salesByDayMap.get(date) ?? {
      date,
      total: 0,
      orders: 0,
    }

    existing.total += Number(order.total)
    existing.orders += 1
    salesByDayMap.set(date, existing)
  }

  const salesByDay = [...salesByDayMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  return {
    totalOrders,
    grossRevenue: Number(grossRevenue.toFixed(2)),
    totalItemsSold,
    averageTicket: Number(averageTicket.toFixed(2)),
    statusCounts,
    paymentMethodTotals: {
      money: Number(paymentMethodTotals.money.toFixed(2)),
      pix: Number(paymentMethodTotals.pix.toFixed(2)),
      credit: Number(paymentMethodTotals.credit.toFixed(2)),
      debit: Number(paymentMethodTotals.debit.toFixed(2)),
      unknown: Number(paymentMethodTotals.unknown.toFixed(2)),
    },
    topProducts: topProducts.map((product) => ({
      ...product,
      revenue: Number(product.revenue.toFixed(2)),
    })),
    salesByDay: salesByDay.map((day) => ({
      ...day,
      total: Number(day.total.toFixed(2)),
    })),
  }
}

async function assertInternalCustomerCanReceiveOrder(internalCustomerId?: string | null) {
  if (!internalCustomerId) return

  const internalCustomer = await prisma.internalCustomer.findUnique({
    where: {
      id: internalCustomerId,
    },
    select: {
      id: true,
      active: true,
    },
  })

  if (!internalCustomer) {
    throw new Error('INTERNAL_CUSTOMER_NOT_FOUND')
  }

  if (!internalCustomer.active) {
    throw new Error('INTERNAL_CUSTOMER_DISABLED')
  }
}