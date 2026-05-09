import { PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type PaySelectedOrdersInput = {
  paymentMethod: PaymentMethod | string
  taxApplied?: boolean
  orderIds: string[]
}

const orderInclude: Prisma.OrderInclude = {
  items: {
    include: {
      product: {
        include: {
          variationGroups: {
            include: {
              options: true,
            },
          },
        },
      },
    },
  },
}

async function customerHasPendingOrders(customerId: string) {
  const count = await prisma.order.count({
    where: {
      internalCustomerId: customerId,
      status: 'pending',
    },
  })

  return count > 0
}

async function findInternalCustomerForPdv(customerId: string) {
  const customer = await prisma.internalCustomer.findUnique({
    where: { id: customerId },
    include: {
      salesEnvironment: true,
    },
  })

  if (!customer) {
    throw new Error('INTERNAL_CUSTOMER_NOT_FOUND')
  }

  if (customer.active) {
    return customer
  }

  const hasPendingOrders = await customerHasPendingOrders(customerId)

  if (!hasPendingOrders) {
    throw new Error('INTERNAL_CUSTOMER_NOT_FOUND')
  }

  return customer
}

export async function listInternalCustomers() {
  return prisma.internalCustomer.findMany({
    where: {
      OR: [
        { active: true },
        {
          active: false,
          orders: {
            some: {
              status: 'pending',
            },
          },
        },
      ],
    },
    orderBy: {
      name: 'asc',
    },
    include: {
      salesEnvironment: true,
    },
  })
}

export const getInternalCustomers = listInternalCustomers

export async function getInternalCustomerTodayOrders(customerId: string) {
  const customer = await findInternalCustomerForPdv(customerId)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const orders = await prisma.order.findMany({
    where: {
      internalCustomerId: customerId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: orderInclude,
  })

  return {
    customer,
    orders,
  }
}

export async function getInternalCustomerPendingOrders(customerId: string) {
  const customer = await findInternalCustomerForPdv(customerId)

  const orders = await prisma.order.findMany({
    where: {
      internalCustomerId: customerId,
      status: 'pending',
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: orderInclude,
  })

  const pendingTotal = orders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0
  )

  return {
    customer,
    orders,
    summary: {
      pendingCount: orders.length,
      pendingTotal,
    },
  }
}

export async function updateInternalCustomer(
  customerId: string,
  data: {
    name: string
    phone?: string | null
    salesEnvironmentId: string
  }
) {
  const existing = await prisma.internalCustomer.findUnique({
    where: { id: customerId },
  })

  if (!existing) {
    throw new Error('INTERNAL_CUSTOMER_NOT_FOUND')
  }

  return prisma.internalCustomer.update({
    where: { id: customerId },
    data: {
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      salesEnvironmentId: data.salesEnvironmentId,
    },
    include: {
      salesEnvironment: true,
    },
  })
}

export async function deleteInternalCustomer(customerId: string) {
  const existing = await prisma.internalCustomer.findUnique({
    where: { id: customerId },
  })

  if (!existing) {
    throw new Error('INTERNAL_CUSTOMER_NOT_FOUND')
  }

  const hasPendingOrders = await customerHasPendingOrders(customerId)

  if (hasPendingOrders) {
    throw new Error('INTERNAL_CUSTOMER_HAS_OPEN_ORDERS')
  }

  await prisma.internalCustomer.update({
    where: { id: customerId },
    data: {
      active: false,
    },
  })

  return { ok: true }
}

export async function paySelectedInternalCustomerOrders(
  customerId: string,
  data: PaySelectedOrdersInput
) {
  await findInternalCustomerForPdv(customerId)

  if (!data.orderIds || data.orderIds.length === 0) {
    throw new Error('NO_ORDERS_SELECTED')
  }

  const paymentMethod = data.paymentMethod as PaymentMethod

  await prisma.order.updateMany({
    where: {
      id: {
        in: data.orderIds,
      },
      internalCustomerId: customerId,
      status: 'pending',
    },
    data: {
      status: 'paid',
      paymentMethod,
      taxApplied: data.taxApplied ?? false,
      paidAt: new Date(),
    },
  })

  const pendingCount = await prisma.order.count({
    where: {
      internalCustomerId: customerId,
      status: 'pending',
    },
  })

  const customer = await prisma.internalCustomer.findUnique({
    where: { id: customerId },
    select: {
      active: true,
    },
  })

  return {
    ok: true,
    shouldRemoveFromInternalPdv: customer?.active === false && pendingCount === 0,
  }
}