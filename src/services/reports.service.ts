import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type ReportStatusFilter = OrderStatus | 'all'
type ReportPaymentFilter = PaymentMethod | 'unknown' | 'all'

type ReportFilters = {
  fromDate?: string
  toDate?: string
  status?: ReportStatusFilter
  paymentMethod?: ReportPaymentFilter
  eventDateId?: string
  salesEnvironmentId?: string
  categoryId?: string
  productId?: string
  customerId?: string
  internalCustomerId?: string
  comanda?: string
  taxApplied?: string
}

type OrderForReport = Prisma.OrderGetPayload<{
  include: {
    eventDate: { include: { salesEnvironment: true; people: { include: { person: true } }; buyRequests: { include: { items: { include: { product: { include: { category: true } } } } } } } }
    internalCustomer: { include: { salesEnvironment: true } }
    customer: true
    items: {
      include: {
        product: {
          include: {
            category: true
            recipeItems: { include: { ingredientProduct: { include: { recipeItems: { include: { ingredientProduct: { include: { recipeItems: { include: { ingredientProduct: true } } } } } } } } } }
          }
        }
        variations: {
          include: {
            group: true
            options: {
              include: {
                option: {
                  include: {
                    recipeItems: { include: { ingredientProduct: { include: { recipeItems: { include: { ingredientProduct: { include: { recipeItems: { include: { ingredientProduct: true } } } } } } } } } }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}>

function toNumber(value: unknown) {
  if (value == null) return 0
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function parseDateFilter(fromDate?: string, toDate?: string) {
  const createdAt: Prisma.DateTimeFilter = {}

  if (fromDate) {
    const [year, month, day] = fromDate.split('-').map(Number)
    if (year && month && day) {
      createdAt.gte = new Date(year, month - 1, day, 0, 0, 0, 0)
    }
  }

  if (toDate) {
    const [year, month, day] = toDate.split('-').map(Number)
    if (year && month && day) {
      createdAt.lte = new Date(year, month - 1, day, 23, 59, 59, 999)
    }
  }

  return Object.keys(createdAt).length ? createdAt : undefined
}

function dateKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10)
}

function hourKey(value: Date | string) {
  return String(new Date(value).getHours()).padStart(2, '0') + ':00'
}

function normalizeToBaseUnit(quantity: number, unit?: string | null) {
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

function getUnitFamily(unit?: string | null) {
  if (unit === 'ml' || unit === 'l') return 'volume'
  if (unit === 'g' || unit === 'kg') return 'weight'
  return 'count'
}

function unitsAreCompatible(fromUnit?: string | null, toUnit?: string | null) {
  return getUnitFamily(fromUnit ?? 'unit') === getUnitFamily(toUnit ?? 'unit')
}

function convertQuantityBetweenUnits(
  quantity: number,
  fromUnit?: string | null,
  toUnit?: string | null
) {
  if (!Number.isFinite(quantity)) return 0

  const from = fromUnit ?? 'unit'
  const to = toUnit ?? from

  if (from === to) return quantity
  if (!unitsAreCompatible(from, to)) return quantity

  const base = normalizeToBaseUnit(quantity, from)
  return to === 'l' || to === 'kg' ? base / 1000 : base
}

function getUnitContentQuantity(product: any) {
  const quantity = toNumber(product?.unitContentQuantity)
  return quantity > 0 ? quantity : null
}

function getUnitContentUnit(product: any) {
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

function getUnitContentBaseQuantity(product: any) {
  if (!hasUnitContent(product)) return 1

  const contentQuantity = getUnitContentQuantity(product) ?? 1
  const contentUnit = getUnitContentUnit(product) ?? 'unit'

  return normalizeToBaseUnit(contentQuantity, contentUnit)
}

/**
 * Cost per stored stock unit.
 *
 * This is used when the sold product itself is a simple stock item.
 * Examples:
 * - stockUnit unit, simpleCost 18 => R$18 per bottle/unit
 * - stockUnit l, referenceCost 18, referenceQuantity 2 => R$9 per liter
 * - stockUnit kg, referenceCost 30, referenceQuantity 5 => R$6 per kg
 */
function getStoredUnitCost(product: any) {
  const referenceCost = toNumber(product?.referenceCost)
  const referenceQuantity = toNumber(product?.referenceQuantity)
  const simpleCost = toNumber(product?.simpleCost)

  if (referenceCost > 0 && referenceQuantity > 0) {
    return referenceCost / referenceQuantity
  }

  if (simpleCost > 0) return simpleCost
  return 0
}

/**
 * Cost per base unit for ingredient usage.
 *
 * Base unit means:
 * - ml for volume
 * - g for weight
 * - unit for count
 *
 * This is used when a product is consumed inside a recipe.
 * It handles cases like:
 * - stockUnit unit + unitContentQuantity 910 + unitContentUnit ml
 * - referenceCost 18 / referenceQuantity 2 l
 * - simpleCost on l/kg normalized to ml/g
 */
function getIngredientBaseUnitCost(product: any) {
  const referenceCost = toNumber(product?.referenceCost)
  const referenceQuantity = toNumber(product?.referenceQuantity)
  const simpleCost = toNumber(product?.simpleCost)
  const stockUnit = product?.stockUnit ?? 'unit'

  if (referenceCost > 0 && referenceQuantity > 0) {
    const referenceBaseQuantity = hasUnitContent(product)
      ? referenceQuantity * getUnitContentBaseQuantity(product)
      : normalizeToBaseUnit(referenceQuantity, stockUnit)

    return referenceBaseQuantity > 0 ? referenceCost / referenceBaseQuantity : 0
  }

  if (simpleCost > 0) {
    if (hasUnitContent(product)) {
      const contentBaseQuantity = getUnitContentBaseQuantity(product)
      return contentBaseQuantity > 0 ? simpleCost / contentBaseQuantity : 0
    }

    if (stockUnit === 'l' || stockUnit === 'kg') {
      return simpleCost / 1000
    }

    return simpleCost
  }

  return 0
}

function getRecipeOutputBaseQuantity(product: any) {
  const outputQuantity = toNumber(product?.recipeOutputQuantity) || 1
  const outputUnit =
    product?.recipeOutputUnit ??
    getEffectiveStockUnit(product) ??
    'unit'

  const outputBaseQuantity = normalizeToBaseUnit(outputQuantity, outputUnit)

  return Number.isFinite(outputBaseQuantity) && outputBaseQuantity > 0
    ? outputBaseQuantity
    : 1
}

function productHasRecipe(product: any) {
  return Boolean(product?.recipeItems?.length)
}

function getRecipeCostForFactor(
  product: any,
  factor: number,
  seen = new Set<string>()
): number {
  if (!product || !Number.isFinite(factor) || factor <= 0) return 0
  if (!productHasRecipe(product)) return getStoredUnitCost(product) * factor
  if (seen.has(product.id)) return 0

  const nextSeen = new Set(seen)
  nextSeen.add(product.id)

  return (product.recipeItems ?? []).reduce((sum: number, recipeItem: any) => {
    const ingredient = recipeItem.ingredientProduct
    const quantity = toNumber(recipeItem.quantity) * factor

    if (!ingredient || quantity <= 0) return sum

    return (
      sum +
      getProductCostForIngredientQuantity(
        ingredient,
        quantity,
        recipeItem.unit,
        nextSeen
      )
    )
  }, 0)
}

/**
 * Cost when a product is used as an ingredient.
 *
 * This function mirrors the stock-consumption logic from orders.service.ts:
 * - if the ingredient is itself a recipe/madeOnDemand product, it expands the recipe;
 * - otherwise it converts the requested quantity into base units and applies base-unit cost.
 */
function getProductCostForIngredientQuantity(
  product: any,
  quantity: number,
  unit?: string | null,
  seen = new Set<string>()
): number {
  if (!product || !Number.isFinite(quantity) || quantity <= 0) return 0

  if (productHasRecipe(product) || product.costMode === 'recipe' || product.madeOnDemand) {
    if (seen.has(product.id)) return 0

    const requestedBaseQuantity = normalizeToBaseUnit(
      quantity,
      unit ?? product.recipeOutputUnit ?? getEffectiveStockUnit(product)
    )
    const outputBaseQuantity = getRecipeOutputBaseQuantity(product)
    const factor = outputBaseQuantity > 0 ? requestedBaseQuantity / outputBaseQuantity : quantity

    return getRecipeCostForFactor(product, factor, seen)
  }

  const effectiveStockUnit = getEffectiveStockUnit(product, unit)
  const requestedUnit = unit ?? effectiveStockUnit

  if (!unitsAreCompatible(requestedUnit, effectiveStockUnit)) {
    return 0
  }

  const requestedBaseQuantity = normalizeToBaseUnit(quantity, requestedUnit)
  return requestedBaseQuantity * getIngredientBaseUnitCost(product)
}

/**
 * Cost when the product itself was sold in an order.
 *
 * OrderItem.quantity is the count of sold products.
 * - recipe product: quantity multiplies the full recipe output;
 * - simple product: quantity is treated as the stored stock unit, matching order stock decrement logic.
 */
function getProductCostForOrderQuantity(product: any, orderQuantity: number) {
  if (!product || !Number.isFinite(orderQuantity) || orderQuantity <= 0) return 0

  if (productHasRecipe(product) || product.costMode === 'recipe' || product.madeOnDemand) {
    return getRecipeCostForFactor(product, orderQuantity)
  }

  return getStoredUnitCost(product) * orderQuantity
}

function getVariationOptionCostForOrderQuantity(option: any, orderQuantity: number) {
  if (!option || !Number.isFinite(orderQuantity) || orderQuantity <= 0) return 0

  if (option.costMode !== 'recipe' && !(option.recipeItems?.length)) {
    return getStoredUnitCost(option) * orderQuantity
  }

  return (option.recipeItems ?? []).reduce((sum: number, recipeItem: any) => {
    const ingredient = recipeItem.ingredientProduct
    const quantity = toNumber(recipeItem.quantity) * orderQuantity

    if (!ingredient || quantity <= 0) return sum

    return (
      sum +
      getProductCostForIngredientQuantity(
        ingredient,
        quantity,
        recipeItem.unit
      )
    )
  }, 0)
}

function estimateOrderItemCost(item: OrderForReport['items'][number]) {
  const quantity = toNumber(item.quantity)
  if (quantity <= 0) return 0

  const productCost = getProductCostForOrderQuantity(item.product, quantity)

  const variationCost = (item.variations ?? []).reduce((sum, selection) => {
    return sum + (selection.options ?? []).reduce((optionSum, selectedOption) => {
      return (
        optionSum +
        getVariationOptionCostForOrderQuantity(selectedOption.option, quantity)
      )
    }, 0)
  }, 0)

  return productCost + variationCost
}

function estimateOrderCost(order: OrderForReport) {
  return order.items.reduce((sum, item) => sum + estimateOrderItemCost(item), 0)
}

function estimateStaffCost(eventDate: NonNullable<OrderForReport['eventDate']>) {
  return (eventDate.people ?? [])
    .filter((item) => item.status !== 'declined')
    .reduce((sum, item) => {
      const override = toNumber(item.costOverride)
      if (override > 0) return sum + override

      const amount = toNumber(item.person.rateAmount)
      if (amount <= 0) return sum

      const rateType = item.person.rateType ?? 'EVENT'
      if (rateType === 'HOURLY') {
        const start = new Date(eventDate.startAt).getTime()
        const end = eventDate.endAt ? new Date(eventDate.endAt).getTime() : start
        const eventHours = end > start ? (end - start) / 3_600_000 : 0
        const hours = item.worksFullEvent === false ? toNumber(item.workHours) : eventHours
        return sum + amount * Math.max(0, hours)
      }

      if (rateType === 'DAILY' || rateType === 'EVENT') return sum + amount
      return sum
    }, 0)
}

function getBuyItemCost(item: any) {
  if (item.status === 'not_bought') return 0
  const boughtQuantity = toNumber(item.boughtQuantity)
  if (boughtQuantity <= 0) return 0

  const total = toNumber(item.totalPrice)
  if (total > 0) return total

  const unitPrice = toNumber(item.unitPrice)
  return unitPrice > 0 ? unitPrice * boughtQuantity : 0
}

function estimateEventBuyCost(eventDate: NonNullable<OrderForReport['eventDate']>) {
  return (eventDate.buyRequests ?? [])
    .filter((request) => request.status === 'received' || request.status === 'partially_received')
    .reduce((sum, request) => {
      return sum + (request.items ?? []).reduce((itemSum, item) => itemSum + getBuyItemCost(item), 0)
    }, 0)
}

function getOrderEnvironment(order: OrderForReport) {
  return order.eventDate?.salesEnvironment ?? order.internalCustomer?.salesEnvironment ?? null
}

function paymentLabel(method: string | null) {
  const labels: Record<string, string> = {
    money: 'Dinheiro',
    pix: 'Pix',
    credit: 'Crédito',
    debit: 'Débito',
    unknown: 'Sem método',
  }

  return labels[method ?? 'unknown'] ?? method ?? 'Sem método'
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    cancelled: 'Cancelado',
  }

  return labels[status] ?? status
}


const weekdayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function weekdayLabel(value: Date | string) {
  return weekdayLabels[new Date(value).getDay()] ?? '-'
}

function monthPeriodLabel(day: number) {
  if (day <= 10) return 'Início do mês'
  if (day <= 20) return 'Meio do mês'
  return 'Fim do mês'
}

function monthPeriodSort(label: string) {
  if (label === 'Início do mês') return 1
  if (label === 'Meio do mês') return 2
  if (label === 'Fim do mês') return 3
  return 99
}

function isoWeekStart(value: Date | string) {
  const date = new Date(value)
  const day = date.getDay() || 7
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - day + 1)
  return start
}

function weekKey(value: Date | string) {
  return dateKey(isoWeekStart(value))
}

function addMetricRow(
  map: Map<string, any>,
  key: string,
  seed: Record<string, any>,
  orderRevenue: number,
  orderCost: number,
  orderStatus: string
) {
  const row: Record<string, any> = map.get(key) ?? { ...seed }
  row.orders = toNumber(row.orders) + 1
  row.paidOrders = toNumber(row.paidOrders) + (orderStatus === 'paid' ? 1 : 0)
  row.revenue = toNumber(row.revenue) + orderRevenue
  row.cost = toNumber(row.cost) + orderCost
  row.profit = toNumber(row.revenue) - toNumber(row.cost)
  row.averageTicket = toNumber(row.paidOrders) > 0 ? toNumber(row.revenue) / toNumber(row.paidOrders) : 0
  map.set(key, row)
  return row
}

function buildWhere(companyId: string, filters: ReportFilters) {
  const createdAt = parseDateFilter(filters.fromDate, filters.toDate)
  const where: Prisma.OrderWhereInput = {
    companyId,
    ...(createdAt ? { createdAt } : {}),
  }

  const andFilters: Prisma.OrderWhereInput[] = []

  if (filters.status && filters.status !== 'all') where.status = filters.status

  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    where.paymentMethod = filters.paymentMethod === 'unknown' ? null : filters.paymentMethod
  }

  if (filters.eventDateId && filters.eventDateId !== 'all') where.eventDateId = filters.eventDateId
  if (filters.customerId && filters.customerId !== 'all') where.customerId = filters.customerId
  if (filters.internalCustomerId && filters.internalCustomerId !== 'all') where.internalCustomerId = filters.internalCustomerId

  if (filters.comanda?.trim()) {
    const comanda = Number(filters.comanda)
    if (Number.isFinite(comanda)) where.comanda = comanda
  }

  if (filters.taxApplied === 'true') where.taxApplied = true
  if (filters.taxApplied === 'false') where.taxApplied = false

  if (filters.productId && filters.productId !== 'all') {
    andFilters.push({ items: { some: { productId: filters.productId } } })
  }

  if (filters.categoryId && filters.categoryId !== 'all') {
    andFilters.push({
      items: {
        some: {
          product: {
            categoryId: filters.categoryId,
          },
        },
      },
    })
  }

  if (filters.salesEnvironmentId && filters.salesEnvironmentId !== 'all') {
    andFilters.push({
      OR: [
        { eventDate: { salesEnvironmentId: filters.salesEnvironmentId } },
        { internalCustomer: { salesEnvironmentId: filters.salesEnvironmentId } },
      ],
    })
  }

  if (andFilters.length > 0) {
    where.AND = andFilters
  }

  return where
}

export async function getReportFilters(companyId: string) {
  const [events, environments, categories, products, customers, internalCustomers] = await Promise.all([
    prisma.eventDate.findMany({
      where: { companyId },
      orderBy: { startAt: 'desc' },
      select: { id: true, title: true, startAt: true, status: true },
      take: 100,
    }),
    prisma.salesEnvironment.findMany({
      where: { companyId, active: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true, isDefault: true },
    }),
    prisma.category.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, categoryId: true },
    }),
    prisma.customer.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.internalCustomer.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, salesEnvironmentId: true },
    }),
  ])

  return {
    events: events.map((event) => ({ ...event, startAt: event.startAt.toISOString() })),
    environments,
    categories,
    products,
    customers,
    internalCustomers,
  }
}

export async function getReportsDashboard(companyId: string, filters: ReportFilters) {
  const where = buildWhere(companyId, filters)

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      eventDate: {
        include: {
          salesEnvironment: true,
          people: { include: { person: true } },
          buyRequests: {
            include: {
              items: {
                include: {
                  product: { include: { category: true } },
                },
              },
            },
          },
        },
      },
      internalCustomer: { include: { salesEnvironment: true } },
      customer: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
              recipeItems: {
                include: {
                  ingredientProduct: {
                    include: {
                      recipeItems: { include: { ingredientProduct: { include: { recipeItems: { include: { ingredientProduct: true } } } } } },
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
                  option: {
                    include: {
                      recipeItems: {
                        include: {
                          ingredientProduct: {
                            include: {
                              recipeItems: { include: { ingredientProduct: { include: { recipeItems: { include: { ingredientProduct: true } } } } } },
                            },
                          },
                        },
                      },
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

  const paidOrders = orders.filter((order) => order.status === 'paid')
  const pendingOrders = orders.filter((order) => order.status === 'pending')
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled')
  const revenueOrders = paidOrders

  const grossRevenue = revenueOrders.reduce((sum, order) => sum + toNumber(order.total), 0)
  const pendingRevenue = pendingOrders.reduce((sum, order) => sum + toNumber(order.total), 0)
  const cancelledRevenue = cancelledOrders.reduce((sum, order) => sum + toNumber(order.total), 0)
  const productCost = revenueOrders.reduce((sum, order) => sum + estimateOrderCost(order), 0)

  const eventCostById = new Map<string, { staffCost: number; buyCost: number; totalCost: number }>()
  const eventOrderIds = new Set<string>()

  for (const order of revenueOrders) {
    if (!order.eventDate) continue
    eventOrderIds.add(order.id)

    if (!eventCostById.has(order.eventDate.id)) {
      const staffCost = estimateStaffCost(order.eventDate)
      const buyCost = estimateEventBuyCost(order.eventDate)
      eventCostById.set(order.eventDate.id, {
        staffCost,
        buyCost,
        totalCost: staffCost + buyCost,
      })
    }
  }

  const eventExtraCost = [...eventCostById.values()].reduce((sum, item) => sum + item.totalCost, 0)
  const totalCost = productCost + eventExtraCost
  const estimatedProfit = grossRevenue - totalCost
  const marginPercent = grossRevenue > 0 ? (estimatedProfit / grossRevenue) * 100 : 0
  const cancellationRate = orders.length ? (cancelledOrders.length / orders.length) * 100 : 0
  const averageTicket = revenueOrders.length ? grossRevenue / revenueOrders.length : 0
  const totalItemsSold = revenueOrders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + toNumber(item.quantity), 0)
  }, 0)

  const statusCounts = {
    pending: pendingOrders.length,
    paid: paidOrders.length,
    cancelled: cancelledOrders.length,
  }

  const salesByDay = new Map<string, any>()
  const salesByHour = new Map<string, any>()
  const paymentMethods = new Map<string, any>()
  const productMap = new Map<string, any>()
  const categoryMap = new Map<string, any>()
  const environmentMap = new Map<string, any>()
  const eventMap = new Map<string, any>()
  const customerMap = new Map<string, any>()
  const productVariationMap = new Map<string, any>()
  const bestHourByDayMap = new Map<string, any>()
  const bestDayByWeekMap = new Map<string, any>()
  const weekdayMap = new Map<string, any>()
  const monthPeriodMap = new Map<string, any>()

  for (const order of orders) {
    const orderRevenue = order.status === 'paid' ? toNumber(order.total) : 0
    const orderCost = order.status === 'paid' ? estimateOrderCost(order) : 0
    const createdDate = dateKey(order.createdAt)
    const createdHour = hourKey(order.createdAt)
    const environment = getOrderEnvironment(order)
    const paymentMethod = order.paymentMethod ?? 'unknown'
    const weekStart = weekKey(order.createdAt)
    const dayOfWeek = weekdayLabel(order.createdAt)
    const monthPeriod = monthPeriodLabel(new Date(order.createdAt).getDate())

    addMetricRow(
      bestHourByDayMap,
      `${createdDate}:${createdHour}`,
      { date: createdDate, hour: createdHour, orders: 0, paidOrders: 0, revenue: 0, cost: 0, profit: 0, averageTicket: 0 },
      orderRevenue,
      orderCost,
      order.status
    )

    addMetricRow(
      bestDayByWeekMap,
      `${weekStart}:${createdDate}`,
      { weekStart, date: createdDate, weekday: dayOfWeek, orders: 0, paidOrders: 0, revenue: 0, cost: 0, profit: 0, averageTicket: 0 },
      orderRevenue,
      orderCost,
      order.status
    )

    addMetricRow(
      weekdayMap,
      dayOfWeek,
      { weekday: dayOfWeek, orders: 0, paidOrders: 0, revenue: 0, cost: 0, profit: 0, averageTicket: 0 },
      orderRevenue,
      orderCost,
      order.status
    )

    addMetricRow(
      monthPeriodMap,
      monthPeriod,
      { period: monthPeriod, orders: 0, paidOrders: 0, revenue: 0, cost: 0, profit: 0, averageTicket: 0 },
      orderRevenue,
      orderCost,
      order.status
    )

    const day = salesByDay.get(createdDate) ?? { date: createdDate, orders: 0, paidOrders: 0, revenue: 0, cost: 0, profit: 0 }
    day.orders += 1
    if (order.status === 'paid') day.paidOrders += 1
    day.revenue += orderRevenue
    day.cost += orderCost
    day.profit = day.revenue - day.cost
    salesByDay.set(createdDate, day)

    const hour = salesByHour.get(createdHour) ?? { hour: createdHour, orders: 0, revenue: 0, cost: 0, profit: 0 }
    hour.orders += 1
    hour.revenue += orderRevenue
    hour.cost += orderCost
    hour.profit = hour.revenue - hour.cost
    salesByHour.set(createdHour, hour)

    const payment = paymentMethods.get(paymentMethod) ?? {
      paymentMethod,
      label: paymentLabel(paymentMethod),
      orders: 0,
      revenue: 0,
    }
    payment.orders += order.status === 'paid' ? 1 : 0
    payment.revenue += orderRevenue
    paymentMethods.set(paymentMethod, payment)

    if (environment) {
      const env = environmentMap.get(environment.id) ?? {
        salesEnvironmentId: environment.id,
        name: environment.name,
        color: environment.color,
        orders: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      }
      env.orders += 1
      env.revenue += orderRevenue
      env.cost += orderCost
      env.profit = env.revenue - env.cost
      environmentMap.set(environment.id, env)
    }

    if (order.eventDate) {
      const eventCosts = eventCostById.get(order.eventDate.id) ?? { staffCost: 0, buyCost: 0, totalCost: 0 }
      const event = eventMap.get(order.eventDate.id) ?? {
        eventDateId: order.eventDate.id,
        title: order.eventDate.title,
        startAt: order.eventDate.startAt.toISOString(),
        orders: 0,
        paidOrders: 0,
        revenue: 0,
        productCost: 0,
        staffCost: eventCosts.staffCost,
        buyCost: eventCosts.buyCost,
        totalCost: eventCosts.totalCost,
        profit: -eventCosts.totalCost,
      }
      event.orders += 1
      if (order.status === 'paid') event.paidOrders += 1
      event.revenue += orderRevenue
      event.productCost += orderCost
      event.totalCost = event.productCost + event.staffCost + event.buyCost
      event.profit = event.revenue - event.totalCost
      event.averageTicket = event.paidOrders > 0 ? event.revenue / event.paidOrders : 0
      eventMap.set(order.eventDate.id, event)
    }

    const customerId = order.customerId ?? order.internalCustomerId ?? `comanda:${order.comanda}`
    const customerName = order.customer?.name ?? order.internalCustomer?.name ?? order.comandaName ?? `Comanda ${order.comanda}`
    const customer = customerMap.get(customerId) ?? {
      id: customerId,
      name: customerName,
      type: order.customerId ? 'customer' : order.internalCustomerId ? 'internal' : 'comanda',
      orders: 0,
      revenue: 0,
      averageTicket: 0,
    }
    customer.orders += order.status === 'paid' ? 1 : 0
    customer.revenue += orderRevenue
    customer.averageTicket = customer.orders ? customer.revenue / customer.orders : 0
    customerMap.set(customerId, customer)

    for (const item of order.items) {
      const itemRevenue = order.status === 'paid' ? toNumber(item.totalPrice) : 0
      const itemCost = order.status === 'paid' ? estimateOrderItemCost(item) : 0
      const quantity = order.status === 'paid' ? toNumber(item.quantity) : 0

      const product = productMap.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        categoryId: item.product.categoryId,
        categoryName: item.product.category?.name ?? 'Sem categoria',
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPercent: 0,
      }
      product.quantity += quantity
      product.revenue += itemRevenue
      product.cost += itemCost
      product.profit = product.revenue - product.cost
      product.marginPercent = product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0
      productMap.set(item.productId, product)

      const categoryKey = item.product.categoryId ?? 'uncategorized'
      const category = categoryMap.get(categoryKey) ?? {
        categoryId: categoryKey,
        name: item.product.category?.name ?? 'Sem categoria',
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPercent: 0,
      }
      category.quantity += quantity
      category.revenue += itemRevenue
      category.cost += itemCost
      category.profit = category.revenue - category.cost
      category.marginPercent = category.revenue > 0 ? (category.profit / category.revenue) * 100 : 0
      categoryMap.set(categoryKey, category)

      for (const variation of item.variations ?? []) {
        for (const selectedOption of variation.options ?? []) {
          const option = selectedOption.option
          if (!option) continue

          const variationKey = `${item.productId}:${variation.groupId}:${selectedOption.optionId}`
          const revenueModifier = order.status === 'paid'
            ? toNumber(selectedOption.priceModifier) * quantity
            : 0
          const optionCost = order.status === 'paid'
            ? getVariationOptionCostForOrderQuantity(option, quantity)
            : 0

          const variationRow = productVariationMap.get(variationKey) ?? {
            productId: item.productId,
            productName: item.product.name,
            categoryId: item.product.categoryId,
            categoryName: item.product.category?.name ?? 'Sem categoria',
            variationGroupId: variation.groupId,
            variationGroupName: variation.group?.name ?? 'Variação',
            optionId: selectedOption.optionId,
            optionName: option.name ?? 'Opção',
            selections: 0,
            quantity: 0,
            revenueModifier: 0,
            cost: 0,
            profit: 0,
            marginPercent: 0,
            attachRatePercent: 0,
          }

          variationRow.selections += order.status === 'paid' ? 1 : 0
          variationRow.quantity += quantity
          variationRow.revenueModifier += revenueModifier
          variationRow.cost += optionCost
          variationRow.profit = variationRow.revenueModifier - variationRow.cost
          variationRow.marginPercent = variationRow.revenueModifier > 0
            ? (variationRow.profit / variationRow.revenueModifier) * 100
            : 0

          productVariationMap.set(variationKey, variationRow)
        }
      }
    }
  }

  const rawProductRows = [...productMap.values()]
  const rawVariationRows = [...productVariationMap.values()].map((variation) => {
    const product = productMap.get(variation.productId)
    const productQuantity = toNumber(product?.quantity)

    return {
      ...variation,
      attachRatePercent: productQuantity > 0 ? (toNumber(variation.quantity) / productQuantity) * 100 : 0,
    }
  })

  const productRows = rawProductRows.map((product) => {
    const variations = rawVariationRows
      .filter((variation) => variation.productId === product.productId)
      .sort((a, b) => b.quantity - a.quantity)
      .map(normalizeMoneyObject)

    return normalizeMoneyObject({
      ...product,
      variations,
      topVariation: variations[0] ?? null,
      variationCount: variations.length,
    })
  })

  const topProductVariations = rawVariationRows
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 30)
    .map(normalizeMoneyObject)

  const topProductsByRevenue = [...productRows].sort((a, b) => b.revenue - a.revenue).slice(0, 15)
  const topProductsByProfit = [...productRows].sort((a, b) => b.profit - a.profit).slice(0, 15)
  const topProductsByQuantity = [...productRows].sort((a, b) => b.quantity - a.quantity).slice(0, 15)
  const topCategories = [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue)
  const topCustomers = [...customerMap.values()].filter((item) => item.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 15)
  const eventPerformance = [...eventMap.values()].sort((a, b) => b.revenue - a.revenue)
  const salesEnvironmentPerformance = [...environmentMap.values()].sort((a, b) => b.revenue - a.revenue)

  const bestDay = [...salesByDay.values()].sort((a, b) => b.revenue - a.revenue)[0] ?? null
  const bestHour = [...salesByHour.values()].sort((a, b) => b.revenue - a.revenue)[0] ?? null
  const bestProduct = topProductsByRevenue[0] ?? null
  const bestProfitProduct = topProductsByProfit[0] ?? null

  const bestHourByDayMapReduced = [...bestHourByDayMap.values()].reduce<Map<string, Record<string, any>>>(
    (map, row) => {
      const current = map.get(row.date)
      if (!current || row.revenue > Number(current.revenue ?? 0)) map.set(row.date, row)
      return map
    },
    new Map<string, Record<string, any>>()
  )

  const bestHourByDay: Record<string, any>[] = [...bestHourByDayMapReduced.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  )

  const bestDayByWeekMapReduced = [...bestDayByWeekMap.values()].reduce<Map<string, Record<string, any>>>(
    (map, row) => {
      const current = map.get(row.weekStart)
      if (!current || row.revenue > Number(current.revenue ?? 0)) map.set(row.weekStart, row)
      return map
    },
    new Map<string, Record<string, any>>()
  )

  const bestDayByWeek: Record<string, any>[] = [...bestDayByWeekMapReduced.values()].sort((a, b) =>
    String(a.weekStart).localeCompare(String(b.weekStart))
  )

  const monthPeriodPerformance = [...monthPeriodMap.values()].sort((a, b) => monthPeriodSort(a.period) - monthPeriodSort(b.period))
  const weekdayPerformance = [...weekdayMap.values()].sort((a, b) => b.revenue - a.revenue)
  const bestPeriodOfMonth = [...monthPeriodPerformance].sort((a, b) => b.revenue - a.revenue)[0] ?? null
  const bestWeekday = weekdayPerformance[0] ?? null
  const ticketByEvent = [...eventMap.values()]
    .filter((event) => toNumber(event.paidOrders) > 0)
    .sort((a, b) => b.averageTicket - a.averageTicket)

  function normalizeMoneyObject<T extends Record<string, any>>(item: T): T {
    const next: Record<string, any> = { ...item }

    for (const key of Object.keys(next)) {
      if (
        [
          'revenue',
          'cost',
          'profit',
          'totalCost',
          'productCost',
          'staffCost',
          'buyCost',
          'averageTicket',
          'marginPercent',
          'revenueModifier',
          'attachRatePercent',
        ].includes(key)
      ) {
        next[key] = round(
          Number(next[key] ?? 0),
          key === 'marginPercent' ? 1 : 2
        )
      }
    }

    return next as T
  }

  return {
    filters,
    summary: {
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      cancelledOrders: cancelledOrders.length,
      grossRevenue: round(grossRevenue),
      pendingRevenue: round(pendingRevenue),
      cancelledRevenue: round(cancelledRevenue),
      productCost: round(productCost),
      eventCost: round(eventExtraCost),
      staffCost: round([...eventCostById.values()].reduce((sum, item) => sum + item.staffCost, 0)),
      buyCost: round([...eventCostById.values()].reduce((sum, item) => sum + item.buyCost, 0)),
      totalCost: round(totalCost),
      estimatedProfit: round(estimatedProfit),
      marginPercent: round(marginPercent, 1),
      averageTicket: round(averageTicket),
      totalItemsSold,
      cancellationRate: round(cancellationRate, 1),
      statusCounts,
    },
    highlights: {
      bestDay: bestDay ? normalizeMoneyObject(bestDay) : null,
      bestHour: bestHour ? normalizeMoneyObject(bestHour) : null,
      bestProduct: bestProduct ? normalizeMoneyObject(bestProduct) : null,
      bestProfitProduct: bestProfitProduct ? normalizeMoneyObject(bestProfitProduct) : null,
      bestPeriodOfMonth: bestPeriodOfMonth ? normalizeMoneyObject(bestPeriodOfMonth) : null,
      bestWeekday: bestWeekday ? normalizeMoneyObject(bestWeekday) : null,
    },
    analytics: {
      bestHourByDay: bestHourByDay.map((item) => normalizeMoneyObject(item)),
      bestDayByWeek: bestDayByWeek.map((item) => normalizeMoneyObject(item)),
      monthPeriodPerformance: monthPeriodPerformance.map(normalizeMoneyObject),
      weekdayPerformance: weekdayPerformance.map(normalizeMoneyObject),
      ticketByEvent: ticketByEvent.map(normalizeMoneyObject),
    },
    charts: {
      salesByDay: [...salesByDay.values()].sort((a, b) => a.date.localeCompare(b.date)).map(normalizeMoneyObject),
      salesByHour: [...salesByHour.values()].sort((a, b) => a.hour.localeCompare(b.hour)).map(normalizeMoneyObject),
      paymentMethods: [...paymentMethods.values()].map(normalizeMoneyObject).filter((item) => item.revenue > 0 || item.orders > 0),
      status: Object.entries(statusCounts).map(([status, count]) => ({ status, label: statusLabel(status), count })),
      categories: topCategories.map(normalizeMoneyObject),
      productsByRevenue: topProductsByRevenue.map(normalizeMoneyObject),
      productsByProfit: topProductsByProfit.map(normalizeMoneyObject),
      productsByQuantity: topProductsByQuantity.map(normalizeMoneyObject),
      productVariations: topProductVariations,
      environments: salesEnvironmentPerformance.map(normalizeMoneyObject),
      events: eventPerformance.map(normalizeMoneyObject),
      ticketByEvent: ticketByEvent.map(normalizeMoneyObject),
      bestHourByDay: bestHourByDay.map((item) => normalizeMoneyObject(item)),
      bestDayByWeek: bestDayByWeek.map((item) => normalizeMoneyObject(item)),
      monthPeriodPerformance: monthPeriodPerformance.map(normalizeMoneyObject),
      weekdayPerformance: weekdayPerformance.map(normalizeMoneyObject),
      customers: topCustomers.map(normalizeMoneyObject),
    },
    tables: {
      products: [...productRows].sort((a, b) => b.revenue - a.revenue).map(normalizeMoneyObject),
      productVariations: rawVariationRows.sort((a, b) => b.quantity - a.quantity).map(normalizeMoneyObject),
      categories: topCategories.map(normalizeMoneyObject),
      events: eventPerformance.map(normalizeMoneyObject),
      ticketByEvent: ticketByEvent.map(normalizeMoneyObject),
      bestHourByDay: bestHourByDay.map((item) => normalizeMoneyObject(item)),
      bestDayByWeek: bestDayByWeek.map((item) => normalizeMoneyObject(item)),
      monthPeriodPerformance: monthPeriodPerformance.map(normalizeMoneyObject),
      weekdayPerformance: weekdayPerformance.map(normalizeMoneyObject),
      environments: salesEnvironmentPerformance.map(normalizeMoneyObject),
      customers: topCustomers.map(normalizeMoneyObject),
      recentOrders: orders.slice(0, 50).map((order) => ({
        id: order.id,
        comanda: order.comanda,
        comandaName: order.comandaName,
        customerName: order.customer?.name ?? order.internalCustomer?.name ?? order.comandaName ?? null,
        eventTitle: order.eventDate?.title ?? null,
        environmentName: getOrderEnvironment(order)?.name ?? null,
        total: round(toNumber(order.total)),
        cost: round(order.status === 'paid' ? estimateOrderCost(order) : 0),
        profit: round(order.status === 'paid' ? toNumber(order.total) - estimateOrderCost(order) : 0),
        status: order.status,
        paymentMethod: order.paymentMethod,
        taxApplied: order.taxApplied,
        createdAt: order.createdAt.toISOString(),
        paidAt: order.paidAt?.toISOString() ?? null,
        itemsCount: order.items.reduce((sum, item) => sum + toNumber(item.quantity), 0),
        items: order.items.map((item) => ({
          productId: item.productId,
          name: item.product.name,
          categoryName: item.product.category?.name ?? 'Sem categoria',
          quantity: item.quantity,
          unitPrice: round(toNumber(item.unitPrice)),
          totalPrice: round(toNumber(item.totalPrice)),
          estimatedCost: round(estimateOrderItemCost(item)),
          estimatedProfit: round(toNumber(item.totalPrice) - estimateOrderItemCost(item)),
          variations: (item.variations ?? []).flatMap((variation) =>
            (variation.options ?? []).map((selectedOption) => {
              const optionCost = getVariationOptionCostForOrderQuantity(selectedOption.option, toNumber(item.quantity))
              const revenueModifier = toNumber(selectedOption.priceModifier) * toNumber(item.quantity)

              return {
                groupId: variation.groupId,
                groupName: variation.group?.name ?? 'Variação',
                optionId: selectedOption.optionId,
                optionName: selectedOption.option?.name ?? 'Opção',
                priceModifier: round(toNumber(selectedOption.priceModifier)),
                revenueModifier: round(revenueModifier),
                estimatedCost: round(optionCost),
                estimatedProfit: round(revenueModifier - optionCost),
              }
            })
          ),
        })),
      })),
    },
  }
}
