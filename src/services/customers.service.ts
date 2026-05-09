import { prisma } from '../lib/prisma'

const db = prisma as any

function cleanText(value?: string | null) {
  return value?.trim() || null
}

function normalizeSearch(value?: string | null) {
  return value?.trim() || ''
}

function toPositiveInt(value: unknown) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) return null
  return number
}

const customerInclude = {
  eventComandas: {
    include: {
      eventDate: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  _count: {
    select: {
      orders: true,
    },
  },
}

export async function listCustomers(input: {
  companyId: string
  search?: string | null
  includeInactive?: boolean
}) {
  const search = normalizeSearch(input.search)

  const customers = await db.customer.findMany({
    where: {
      companyId: input.companyId,
      ...(input.includeInactive ? {} : { active: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: {
      name: 'asc',
    },
    include: customerInclude,
  })

  const customerIds = customers.map((customer: any) => customer.id)

  if (customerIds.length === 0) return customers

  const totals = await db.order.groupBy({
    by: ['customerId'],
    where: {
      companyId: input.companyId,
      customerId: {
        in: customerIds,
      },
      status: {
        not: 'cancelled',
      },
    },
    _sum: {
      total: true,
    },
  })

  const totalByCustomerId = new Map(
    totals.map((row: any) => [row.customerId, Number(row._sum?.total ?? 0)])
  )

  return customers.map((customer: any) => ({
    ...customer,
    totalSpent: totalByCustomerId.get(customer.id) ?? 0,
  }))
}

export async function getCustomer(companyId: string, id: string) {
  const customer = await db.customer.findFirst({
    where: {
      id,
      companyId,
    },
    include: customerInclude,
  })

  if (!customer) throw new Error('CUSTOMER_NOT_FOUND')

  return customer
}

export async function createCustomer(input: {
  companyId: string
  name: string
  phone?: string | null
  email?: string | null
}) {
  if (!input.name?.trim()) throw new Error('CUSTOMER_NAME_REQUIRED')

  return db.customer.create({
    data: {
      companyId: input.companyId,
      name: input.name.trim(),
      phone: cleanText(input.phone),
      email: cleanText(input.email),
    },
    include: customerInclude,
  })
}

export async function updateCustomer(
  companyId: string,
  id: string,
  input: Partial<{
    name: string
    phone: string | null
    email: string | null
    active: boolean
  }>
) {
  const existing = await db.customer.findFirst({
    where: {
      id,
      companyId,
    },
  })

  if (!existing) throw new Error('CUSTOMER_NOT_FOUND')

  return db.customer.update({
    where: { id },
    data: {
      name: input.name === undefined ? undefined : input.name.trim(),
      phone: input.phone === undefined ? undefined : cleanText(input.phone),
      email: input.email === undefined ? undefined : cleanText(input.email),
      active: input.active,
    },
    include: customerInclude,
  })
}

export async function deactivateCustomer(companyId: string, id: string) {
  const existing = await db.customer.findFirst({
    where: {
      id,
      companyId,
    },
  })

  if (!existing) throw new Error('CUSTOMER_NOT_FOUND')

  return db.customer.update({
    where: { id },
    data: { active: false },
    include: customerInclude,
  })
}

export async function upsertEventCustomerComanda(input: {
  companyId: string
  eventDateId: string
  customerId: string
  comandaNumber: number
  comandaName?: string | null
}) {
  const comandaNumber = toPositiveInt(input.comandaNumber)
  if (!comandaNumber) throw new Error('COMANDA_NUMBER_INVALID')

  const [eventDate, customer] = await Promise.all([
    db.eventDate.findFirst({
      where: {
        id: input.eventDateId,
        companyId: input.companyId,
      },
      select: { id: true },
    }),
    db.customer.findFirst({
      where: {
        id: input.customerId,
        companyId: input.companyId,
        active: true,
      },
      select: { id: true, name: true },
    }),
  ])

  if (!eventDate) throw new Error('EVENT_DATE_NOT_FOUND')
  if (!customer) throw new Error('CUSTOMER_NOT_FOUND')

  const conflictingComanda = await db.eventCustomerComanda.findFirst({
    where: {
      companyId: input.companyId,
      eventDateId: input.eventDateId,
      comandaNumber,
      NOT: {
        customerId: input.customerId,
      },
    },
    include: {
      customer: true,
    },
  })

  if (conflictingComanda?.customer?.active) {
    throw new Error('COMANDA_ALREADY_LINKED_TO_ANOTHER_CUSTOMER')
  }

  if (conflictingComanda && !conflictingComanda.customer?.active) {
    return db.eventCustomerComanda.update({
      where: {
        id: conflictingComanda.id,
      },
      data: {
        customerId: input.customerId,
        comandaName: cleanText(input.comandaName) ?? customer.name,
      },
      include: {
        customer: true,
        eventDate: true,
      },
    })
  }

  return db.eventCustomerComanda.upsert({
    where: {
      eventDateId_customerId: {
        eventDateId: input.eventDateId,
        customerId: input.customerId,
      },
    },
    create: {
      companyId: input.companyId,
      eventDateId: input.eventDateId,
      customerId: input.customerId,
      comandaNumber,
      comandaName: cleanText(input.comandaName) ?? customer.name,
    },
    update: {
      comandaNumber,
      comandaName: cleanText(input.comandaName) ?? customer.name,
    },
    include: {
      customer: true,
      eventDate: true,
    },
  })
}

export async function removeEventCustomerComanda(input: {
  companyId: string
  eventDateId: string
  customerId: string
}) {
  const existing = await db.eventCustomerComanda.findFirst({
    where: {
      companyId: input.companyId,
      eventDateId: input.eventDateId,
      customerId: input.customerId,
    },
  })

  if (!existing) throw new Error('CUSTOMER_COMANDA_NOT_FOUND')

  await db.eventCustomerComanda.delete({
    where: { id: existing.id },
  })

  return { ok: true }
}

export async function lookupCustomerByEventComanda(input: {
  companyId: string
  eventDateId: string
  comandaNumber: number
}) {
  const comandaNumber = toPositiveInt(input.comandaNumber)
  if (!comandaNumber) throw new Error('COMANDA_NUMBER_INVALID')

  const link = await db.eventCustomerComanda.findFirst({
    where: {
      companyId: input.companyId,
      eventDateId: input.eventDateId,
      comandaNumber,
      customer: {
        active: true,
      },
    },
    include: {
      customer: true,
      eventDate: true,
    },
  })

  if (!link) return null

  return {
    id: link.id,
    customerId: link.customerId,
    eventDateId: link.eventDateId,
    comandaNumber: link.comandaNumber,
    comandaName: link.comandaName ?? link.customer.name,
    customer: link.customer,
    eventDate: link.eventDate,
  }
}
