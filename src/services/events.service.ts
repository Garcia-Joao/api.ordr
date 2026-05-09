import { EventDateStatus, EventPersonStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type EventPersonInput = {
  personId: string
  functionName?: string | null
  status?: EventPersonStatus
  notes?: string | null
  worksFullEvent?: boolean
  workHours?: number | string | null
  costOverride?: number | string | null
  costNotes?: string | null
}

function cleanText(value?: string | null) {
  return value?.trim() || null
}

function optionalDecimal(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) return null

  return numberValue
}

function toDateTime(value: string) {
  return new Date(value)
}

async function getDefaultSalesEnvironmentId(companyId: string) {
  const environment = await prisma.salesEnvironment.findFirst({
    where: {
      companyId,
      active: true,
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  return environment?.id ?? null
}


type EventDateStatusFilter = EventDateStatus | 'active' | 'all'

function isEventDateActive(eventDate: { status: EventDateStatus; startAt: Date; endAt?: Date | null }) {
  if (eventDate.status !== 'scheduled') return false

  const now = new Date()
  return eventDate.startAt <= now && (!eventDate.endAt || eventDate.endAt >= now)
}

function withRuntimeStatus<T extends { status: EventDateStatus; startAt: Date; endAt?: Date | null }>(
  eventDate: T
) {
  return {
    ...eventDate,
    runtimeStatus: isEventDateActive(eventDate) ? 'active' : eventDate.status,
    isActiveNow: isEventDateActive(eventDate),
  }
}

function toNumber(value: any) {
  if (value == null) return 0
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const eventDateBuyRequestsInclude = {
  where: {
    status: {
      not: 'cancelled' as const,
    },
  },
  include: {
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
  },
  orderBy: {
    createdAt: 'desc' as const,
  },
}

const eventDateInclude = {
  eventTemplate: true,
  salesEnvironment: true,
  people: {
    include: {
      person: {
        include: {
          functions: {
            include: {
              function: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  buyRequests: eventDateBuyRequestsInclude,
}


async function getEventTemplateStats(companyId: string, eventDateIds: string[]) {
  if (eventDateIds.length === 0) {
    return {
      eventCount: 0,
      finishedEventCount: 0,
      orderCount: 0,
      grossRevenue: 0,
      averageTicket: 0,
      confirmedPeople: 0,
      expectedAudience: 0,
      estimatedPeopleCost: 0,
      estimatedYield: 0,
      estimatedProfit: 0,
    }
  }

  const [orders, people] = await Promise.all([
    prisma.order.findMany({
      where: {
        companyId,
        eventDateId: { in: eventDateIds },
        status: 'paid',
      },
      select: {
        id: true,
        total: true,
      },
    }),
    prisma.eventDatePerson.findMany({
      where: {
        eventDateId: { in: eventDateIds },
        status: 'confirmed',
      },
      include: {
        person: true,
      },
    }),
  ])

  const grossRevenue = orders.reduce((sum, order) => sum + toNumber(order.total), 0)
  const estimatedPeopleCost = people.reduce(
    (sum, item) => sum + toNumber((item.person as any).rateAmount),
    0
  )

  return {
    eventCount: eventDateIds.length,
    finishedEventCount: 0,
    orderCount: orders.length,
    grossRevenue,
    averageTicket: orders.length > 0 ? grossRevenue / orders.length : 0,
    confirmedPeople: people.length,
    expectedAudience: 0,
    estimatedPeopleCost,
    estimatedYield: grossRevenue,
    estimatedProfit: grossRevenue - estimatedPeopleCost,
  }
}


export async function listPeopleForEvents() {
  return prisma.person.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: 'asc',
    },
    include: {
      functions: {
        include: {
          function: true,
        },
      },
      salesEnvironment: true,
    },
  })
}

export async function listEventTemplates(companyId: string) {
  const templates = await prisma.eventTemplate.findMany({
    where: {
      companyId,
      active: true,
    },
    orderBy: {
      title: 'asc',
    },
    include: {
      salesEnvironment: true,
      fixedPeople: {
        include: {
          person: {
            include: {
              functions: {
                include: {
                  function: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      eventDates: {
        orderBy: [{ startAt: 'desc' }],
        include: {
          salesEnvironment: true,
          people: {
            include: {
              person: {
                include: {
                  functions: {
                    include: {
                      function: true,
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

  return Promise.all(
    templates.map(async (template) => {
      const eventDates = template.eventDates.map(withRuntimeStatus)
      const finishedPastEventDates = template.eventDates.filter(
        (eventDate) => eventDate.status === 'done' && eventDate.startAt < new Date()
      )

      const stats = await getEventTemplateStats(
        companyId,
        finishedPastEventDates.map((eventDate) => eventDate.id)
      )

      const expectedAudience = finishedPastEventDates.reduce(
        (sum, eventDate) => sum + toNumber((eventDate as any).expectedAudience),
        0
      )
      const finishedEventCount = finishedPastEventDates.length

      return {
        ...template,
        eventDates,
        stats: {
          ...stats,
          expectedAudience,
          finishedEventCount,
        },
      }
    })
  )
}

export async function getEventTemplate(companyId: string, id: string) {
  const template = await prisma.eventTemplate.findFirst({
    where: {
      id,
      companyId,
    },
    include: {
      salesEnvironment: true,
      fixedPeople: {
        include: {
          person: {
            include: {
              functions: {
                include: {
                  function: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!template) {
    throw new Error('EVENT_TEMPLATE_NOT_FOUND')
  }

  return template
}

export async function createEventTemplate(input: {
  companyId: string
  title: string
  description?: string | null
  notes?: string | null
  defaultExpectedAudience?: number | null
  defaultStartTime?: string | null
  defaultEndTime?: string | null
  salesEnvironmentId?: string | null
  fixedPeople?: Array<{
    personId: string
    functionName?: string | null
    notes?: string | null
  }>
}) {
  if (!input.title?.trim()) {
    throw new Error('EVENT_TEMPLATE_TITLE_REQUIRED')
  }

  return prisma.eventTemplate.create({
    data: {
      companyId: input.companyId,
      title: input.title.trim(),
      description: cleanText(input.description),
      notes: cleanText(input.notes),
      defaultExpectedAudience: input.defaultExpectedAudience ?? null,
      defaultStartTime: cleanText(input.defaultStartTime),
      defaultEndTime: cleanText(input.defaultEndTime),
      salesEnvironmentId:
        input.salesEnvironmentId ??
        (await getDefaultSalesEnvironmentId(input.companyId)),
      fixedPeople: input.fixedPeople?.length
        ? {
            create: input.fixedPeople
              .filter((person) => person.personId)
              .map((person) => ({
                personId: person.personId,
                functionName: cleanText(person.functionName),
                notes: cleanText(person.notes),
              })),
          }
        : undefined,
    },
    include: {
      salesEnvironment: true,
      fixedPeople: {
        include: {
          person: {
            include: {
              functions: {
                include: {
                  function: true,
                },
              },
            },
          },
        },
      },
    },
  })
}

export async function updateEventTemplate(
  companyId: string,
  id: string,
  input: {
    title?: string
    description?: string | null
    notes?: string | null
    defaultExpectedAudience?: number | null
    defaultStartTime?: string | null
    defaultEndTime?: string | null
    salesEnvironmentId?: string | null
    active?: boolean
    fixedPeople?: Array<{
      personId: string
      functionName?: string | null
      notes?: string | null
    }>
  }
) {
  const existing = await prisma.eventTemplate.findFirst({
    where: {
      id,
      companyId,
    },
  })

  if (!existing) {
    throw new Error('EVENT_TEMPLATE_NOT_FOUND')
  }

  return prisma.$transaction(async (tx) => {
    if (input.fixedPeople) {
      await tx.eventTemplatePerson.deleteMany({
        where: {
          eventTemplateId: id,
        },
      })
    }

    return tx.eventTemplate.update({
      where: {
        id,
      },
      data: {
        title: input.title === undefined ? undefined : input.title.trim(),
        description:
          input.description === undefined ? undefined : cleanText(input.description),
        notes: input.notes === undefined ? undefined : cleanText(input.notes),
        defaultExpectedAudience: input.defaultExpectedAudience,
        defaultStartTime:
          input.defaultStartTime === undefined
            ? undefined
            : cleanText(input.defaultStartTime),
        defaultEndTime:
          input.defaultEndTime === undefined
            ? undefined
            : cleanText(input.defaultEndTime),
        salesEnvironmentId:
          input.salesEnvironmentId === undefined
            ? undefined
            : input.salesEnvironmentId || (await getDefaultSalesEnvironmentId(companyId)),
        active: input.active,
        fixedPeople: input.fixedPeople
          ? {
              create: input.fixedPeople
                .filter((person) => person.personId)
                .map((person) => ({
                  personId: person.personId,
                  functionName: cleanText(person.functionName),
                  notes: cleanText(person.notes),
                })),
            }
          : undefined,
      },
      include: {
        fixedPeople: {
          include: {
            person: {
              include: {
                functions: {
                  include: {
                    function: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  })
}

export async function deleteEventTemplate(companyId: string, id: string) {
  const existing = await prisma.eventTemplate.findFirst({
    where: {
      id,
      companyId,
    },
  })

  if (!existing) {
    throw new Error('EVENT_TEMPLATE_NOT_FOUND')
  }

  return prisma.eventTemplate.update({
    where: {
      id,
    },
    data: {
      active: false,
    },
  })
}

export async function listEventDates(input: {
  companyId: string
  from?: string
  to?: string
  status?: EventDateStatusFilter
}) {
  const startAtFilter: Prisma.DateTimeFilter = {}
  const now = new Date()

  if (input.from) {
    startAtFilter.gte = new Date(`${input.from}T00:00:00`)
  }

  if (input.to) {
    startAtFilter.lte = new Date(`${input.to}T23:59:59`)
  }

  const where: Prisma.EventDateWhereInput = {
    companyId: input.companyId,
    ...(input.from || input.to ? { startAt: startAtFilter } : {}),
  }

  if (input.status === 'active') {
    where.status = 'scheduled'
    where.startAt = {
      ...(typeof where.startAt === 'object' && !Array.isArray(where.startAt)
        ? where.startAt
        : {}),
      lte: now,
    }
    where.OR = [{ endAt: { gte: now } }, { endAt: null }]
  } else if (input.status && input.status !== 'all') {
    where.status = input.status
  }

  const eventDates = await prisma.eventDate.findMany({
    where,
    orderBy: [{ startAt: 'asc' }],
    include: eventDateInclude,
  })

  return eventDates.map(withRuntimeStatus)
}

export async function listCurrentEventDates(companyId: string) {
  const now = new Date()

  const eventDates = await prisma.eventDate.findMany({
    where: {
      companyId,
      status: 'scheduled',
      startAt: { lte: now },
      OR: [{ endAt: { gte: now } }, { endAt: null }],
    },
    orderBy: [{ startAt: 'asc' }],
    include: eventDateInclude,
  })

  return eventDates.map(withRuntimeStatus)
}

export async function getEventDate(companyId: string, id: string) {
  const eventDate = await prisma.eventDate.findFirst({
    where: {
      id,
      companyId,
    },
    include: eventDateInclude,
  })

  if (!eventDate) {
    throw new Error('EVENT_DATE_NOT_FOUND')
  }

  return withRuntimeStatus(eventDate)
}

export async function createEventDate(input: {
  companyId: string
  eventTemplateId?: string | null
  title?: string | null
  description?: string | null
  notes?: string | null
  startAt: string
  endAt?: string | null
  expectedAudience?: number | null
  salesEnvironmentId?: string | null
  people?: EventPersonInput[]
}) {
  if (!input.startAt) {
    throw new Error('EVENT_START_AT_REQUIRED')
  }

  const template = input.eventTemplateId
    ? await prisma.eventTemplate.findFirst({
        where: {
          id: input.eventTemplateId,
          companyId: input.companyId,
          active: true,
        },
        include: {
          fixedPeople: true,
        },
      })
    : null

  if (input.eventTemplateId && !template) {
    throw new Error('EVENT_TEMPLATE_NOT_FOUND')
  }

  const templatePeople =
    template?.fixedPeople.map((person) => ({
      personId: person.personId,
      functionName: person.functionName,
      status: 'pending' as EventPersonStatus,
      notes: person.notes,
      worksFullEvent: true,
      workHours: null,
      costOverride: null,
      costNotes: null,
    })) ?? []

  const people = input.people?.length ? input.people : templatePeople

  return prisma.eventDate.create({
    data: {
      companyId: input.companyId,
      eventTemplateId: input.eventTemplateId ?? null,
      title: input.title?.trim() || template?.title || 'Evento sem título',
      description: cleanText(input.description) ?? template?.description ?? null,
      notes: cleanText(input.notes),
      startAt: toDateTime(input.startAt),
      endAt: input.endAt ? toDateTime(input.endAt) : null,
      expectedAudience:
        input.expectedAudience ?? template?.defaultExpectedAudience ?? null,
      salesEnvironmentId:
        input.salesEnvironmentId ??
        template?.salesEnvironmentId ??
        (await getDefaultSalesEnvironmentId(input.companyId)),
      people: people.length
        ? {
            create: people
              .filter((person) => person.personId)
              .map((person) => ({
                personId: person.personId,
                functionName: cleanText(person.functionName),
                status: person.status ?? 'pending',
                notes: cleanText(person.notes),
                worksFullEvent: person.worksFullEvent ?? true,
                workHours: optionalDecimal(person.workHours) as any,
                costOverride: optionalDecimal(person.costOverride) as any,
                costNotes: cleanText(person.costNotes),
              })),
          }
        : undefined,
    },
    include: eventDateInclude,
  })
}

export async function updateEventDate(
  companyId: string,
  id: string,
  input: {
    title?: string
    description?: string | null
    notes?: string | null
    startAt?: string
    endAt?: string | null
    expectedAudience?: number | null
    salesEnvironmentId?: string | null
    status?: EventDateStatus
    people?: EventPersonInput[]
  }
) {
  const existing = await prisma.eventDate.findFirst({
    where: {
      id,
      companyId,
    },
  })

  if (!existing) {
    throw new Error('EVENT_DATE_NOT_FOUND')
  }

  return prisma.$transaction(async (tx) => {
    if (input.people) {
      await tx.eventDatePerson.deleteMany({
        where: {
          eventDateId: id,
        },
      })
    }

    return tx.eventDate.update({
      where: {
        id,
      },
      data: {
        title: input.title === undefined ? undefined : input.title.trim(),
        description:
          input.description === undefined ? undefined : cleanText(input.description),
        notes: input.notes === undefined ? undefined : cleanText(input.notes),
        startAt: input.startAt ? toDateTime(input.startAt) : undefined,
        endAt:
          input.endAt === undefined
            ? undefined
            : input.endAt
              ? toDateTime(input.endAt)
              : null,
        expectedAudience: input.expectedAudience,
        salesEnvironmentId:
          input.salesEnvironmentId === undefined
            ? undefined
            : input.salesEnvironmentId || (await getDefaultSalesEnvironmentId(companyId)),
        status: input.status,
        people: input.people
          ? {
              create: input.people
                .filter((person) => person.personId)
                .map((person) => ({
                  personId: person.personId,
                  functionName: cleanText(person.functionName),
                  status: person.status ?? 'pending',
                  notes: cleanText(person.notes),
                  worksFullEvent: person.worksFullEvent ?? true,
                  workHours: optionalDecimal(person.workHours) as any,
                  costOverride: optionalDecimal(person.costOverride) as any,
                  costNotes: cleanText(person.costNotes),
                })),
            }
          : undefined,
      },
      include: eventDateInclude,
    })
  })
}

export async function updateEventDatePersonStatus(input: {
  companyId: string
  eventDateId: string
  personId: string
  functionName?: string | null
  status?: EventPersonStatus
  notes?: string | null
  worksFullEvent?: boolean
  workHours?: number | string | null
  costOverride?: number | string | null
  costNotes?: string | null
}) {
  const existingEvent = await prisma.eventDate.findFirst({
    where: {
      id: input.eventDateId,
      companyId: input.companyId,
    },
  })

  if (!existingEvent) {
    throw new Error('EVENT_DATE_NOT_FOUND')
  }

  const existingPerson = await prisma.eventDatePerson.findFirst({
    where: {
      eventDateId: input.eventDateId,
      personId: input.personId,
      functionName: cleanText(input.functionName),
    },
  })

  if (!existingPerson) {
    throw new Error('EVENT_DATE_PERSON_NOT_FOUND')
  }

  return prisma.eventDatePerson.update({
    where: {
      id: existingPerson.id,
    },
    data: {
      status: input.status,
      notes: input.notes === undefined ? undefined : cleanText(input.notes),
      worksFullEvent: input.worksFullEvent,
      workHours: optionalDecimal(input.workHours) as any,
      costOverride: optionalDecimal(input.costOverride) as any,
      costNotes: input.costNotes === undefined ? undefined : cleanText(input.costNotes),
    },
    include: {
      person: true,
    },
  })
}

export async function cancelEventDate(companyId: string, id: string) {
  const existing = await prisma.eventDate.findFirst({
    where: {
      id,
      companyId,
    },
  })

  if (!existing) {
    throw new Error('EVENT_DATE_NOT_FOUND')
  }

  const updated = await prisma.eventDate.update({
    where: { id },
    data: { status: 'cancelled' },
    include: eventDateInclude,
  })

  return withRuntimeStatus(updated)
}

export async function deleteEventDate(companyId: string, id: string) {
  const existing = await prisma.eventDate.findFirst({
    where: {
      id,
      companyId,
    },
  })

  if (!existing) {
    throw new Error('EVENT_DATE_NOT_FOUND')
  }

  if (existing.status !== 'cancelled') {
    throw new Error('EVENT_DATE_MUST_BE_CANCELLED_BEFORE_DELETE')
  }

  return prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: {
        companyId,
        eventDateId: id,
      },
      data: {
        eventDateId: null,
      },
    })

    await tx.eventDate.delete({
      where: {
        id,
      },
    })

    return { ok: true }
  })
}
