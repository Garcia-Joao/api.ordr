import { prisma } from '../lib/prisma'

const DEFAULT_CRITERIA = [
  'Pontualidade',
  'Qualidade técnica',
  'Trabalho em equipe',
  'Atendimento ao cliente',
]

type PersonEvaluationWithDetails = {
  id: string
  companyId: string
  eventDateId: string
  personId: string
  functionName: string
  functionScore: number | null
  generalNotes: string | null
  createdAt: Date
  updatedAt: Date
  eventDate: {
    id: string
    title: string
    startAt: Date
    endAt: Date | null
    status: string
  } | null
  scores: Array<{
    id: string
    evaluationId: string
    criterionId: string
    score: number
    notes: string | null
    criterion: {
      id: string
      name: string
      description: string | null
    }
  }>
}

type SaveEvaluationInput = {
  companyId: string
  eventDateId: string
  personId: string
  functionName: string
  functionScore?: number | null
  generalNotes?: string | null
  scores: Array<{
    criterionId: string
    score: number
    notes?: string | null
  }>
}

function normalizeText(value?: string | null) {
  return value?.trim() || null
}

function assertScore(score: number) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('EVALUATION_SCORE_INVALID')
  }
}

export async function ensureDefaultStaffEvaluationCriteria(companyId: string) {
  for (const name of DEFAULT_CRITERIA) {
    await prisma.staffEvaluationCriterion.upsert({
      where: {
        companyId_name: {
          companyId,
          name,
        },
      },
      update: {
        active: true,
      },
      create: {
        companyId,
        name,
      },
    })
  }
}

export async function listStaffEvaluationCriteria(companyId: string) {
  await ensureDefaultStaffEvaluationCriteria(companyId)

  return prisma.staffEvaluationCriterion.findMany({
    where: {
      companyId,
      active: true,
    },
    orderBy: {
      name: 'asc',
    },
  })
}

export async function createStaffEvaluationCriterion(input: {
  companyId: string
  name: string
  description?: string | null
}) {
  const name = input.name.trim()

  if (!name) {
    throw new Error('CRITERION_NAME_REQUIRED')
  }

  return prisma.staffEvaluationCriterion.upsert({
    where: {
      companyId_name: {
        companyId: input.companyId,
        name,
      },
    },
    update: {
      description: normalizeText(input.description),
      active: true,
    },
    create: {
      companyId: input.companyId,
      name,
      description: normalizeText(input.description),
    },
  })
}

export async function listEventStaffForReview(companyId: string, eventDateId: string) {
  const eventDate = await prisma.eventDate.findFirst({
    where: {
      id: eventDateId,
      companyId,
    },
    include: {
      people: {
        where: {
          status: 'confirmed',
        },
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
    },
  })

  if (!eventDate) {
    throw new Error('EVENT_DATE_NOT_FOUND')
  }

  const now = new Date()
  const ended = eventDate.endAt ? new Date(eventDate.endAt) < now : eventDate.status === 'done'

  if (eventDate.status !== 'done' && !ended) {
    throw new Error('EVENT_DATE_NOT_FINISHED')
  }

  const evaluations = await prisma.staffEvaluation.findMany({
    where: {
      companyId,
      eventDateId,
    },
    include: {
      scores: {
        include: {
          criterion: true,
        },
      },
    },
  })

  const existingByKey = new Map(
    evaluations.map((evaluation) => [
      `${evaluation.personId}:${evaluation.functionName}`,
      evaluation,
    ])
  )

  const rows = eventDate.people.flatMap((item) => {
    const rawFunctionName = item.functionName || item.person.functions?.[0]?.function?.name || 'Pessoa'
    const functionNames = rawFunctionName
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)

    const uniqueFunctionNames = Array.from(new Set(functionNames.length ? functionNames : ['Pessoa']))

    return uniqueFunctionNames.map((functionName) => {
      const key = `${item.personId}:${functionName}`

      return {
        eventDatePersonId: item.id,
        personId: item.personId,
        person: item.person,
        functionName,
        status: item.status,
        evaluation: existingByKey.get(key) ?? null,
      }
    })
  })

  const peopleById = new Map(eventDate.people.map((item) => [item.personId, item]))

  for (const evaluation of evaluations) {
    if (evaluation.functionName !== 'Outros') continue

    const personRow = peopleById.get(evaluation.personId)
    if (!personRow) continue

    rows.push({
      eventDatePersonId: personRow.id,
      personId: personRow.personId,
      person: personRow.person,
      functionName: 'Outros',
      status: personRow.status,
      evaluation,
    })
  }

  return rows
}

export async function saveStaffEvaluation(input: SaveEvaluationInput) {
  const eventDate = await prisma.eventDate.findFirst({
    where: {
      id: input.eventDateId,
      companyId: input.companyId,
    },
    select: {
      id: true,
      status: true,
      endAt: true,
    },
  })

  if (!eventDate) {
    throw new Error('EVENT_DATE_NOT_FOUND')
  }

  const now = new Date()
  const ended = eventDate.endAt ? new Date(eventDate.endAt) < now : eventDate.status === 'done'

  if (eventDate.status !== 'done' && !ended) {
    throw new Error('EVENT_DATE_NOT_FINISHED')
  }

  const confirmedPeople = await prisma.eventDatePerson.findMany({
    where: {
      eventDateId: input.eventDateId,
      personId: input.personId,
      status: 'confirmed',
    },
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
  })

  const confirmedPerson =
    input.functionName === 'Outros'
      ? confirmedPeople[0] ?? null
      : confirmedPeople.find((item) => {
          const rawFunctionName = item.functionName || item.person.functions?.[0]?.function?.name || 'Pessoa'
          const functionNames = rawFunctionName
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)

          return functionNames.includes(input.functionName)
        })

  if (!confirmedPerson) {
    throw new Error('EVENT_CONFIRMED_STAFF_NOT_FOUND')
  }

  const criteriaIds = input.scores.map((score) => score.criterionId)

  const existingCriteria = await prisma.staffEvaluationCriterion.findMany({
    where: {
      companyId: input.companyId,
      id: {
        in: criteriaIds,
      },
      active: true,
    },
    select: {
      id: true,
    },
  })

  const validCriteriaIds = new Set(existingCriteria.map((criterion) => criterion.id))

  const functionScore = input.functionScore ?? 3
  assertScore(functionScore)

  for (const score of input.scores) {
    assertScore(score.score)

    if (!validCriteriaIds.has(score.criterionId)) {
      throw new Error('CRITERION_NOT_FOUND')
    }
  }

  return prisma.$transaction(async (tx) => {
    const evaluation = await tx.staffEvaluation.upsert({
      where: {
        eventDateId_personId_functionName: {
          eventDateId: input.eventDateId,
          personId: input.personId,
          functionName: input.functionName,
        },
      },
      update: {
        functionScore,
        generalNotes: normalizeText(input.generalNotes),
      },
      create: {
        companyId: input.companyId,
        eventDateId: input.eventDateId,
        personId: input.personId,
        functionName: input.functionName,
        functionScore,
        generalNotes: normalizeText(input.generalNotes),
      },
    })

    await tx.staffEvaluationScore.deleteMany({
      where: {
        evaluationId: evaluation.id,
        criterionId: {
          notIn: criteriaIds,
        },
      },
    })

    for (const score of input.scores) {
      await tx.staffEvaluationScore.upsert({
        where: {
          evaluationId_criterionId: {
            evaluationId: evaluation.id,
            criterionId: score.criterionId,
          },
        },
        update: {
          score: score.score,
          notes: normalizeText(score.notes),
        },
        create: {
          evaluationId: evaluation.id,
          criterionId: score.criterionId,
          score: score.score,
          notes: normalizeText(score.notes),
        },
      })
    }

    return tx.staffEvaluation.findUnique({
      where: {
        id: evaluation.id,
      },
      include: {
        person: true,
        eventDate: true,
        scores: {
          include: {
            criterion: true,
          },
          orderBy: {
            criterion: {
              name: 'asc',
            },
          },
        },
      },
    })
  })
}

function getEvaluationAverage(evaluation: any) {
  const scores = evaluation.scores ?? []
  const values: number[] = []

  const functionScore = Number(evaluation.functionScore ?? 0)
  if (Number.isFinite(functionScore) && functionScore > 0) {
    values.push(functionScore)
  }

  for (const score of scores) {
    const value = Number(score.score ?? 0)
    if (Number.isFinite(value) && value > 0) {
      values.push(value)
    }
  }

  if (values.length === 0) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatEventTitle(eventDate: any) {
  return eventDate?.title ?? 'Evento'
}

export async function getPeopleEvaluationRatings(companyId: string) {
  const evaluations = await prisma.staffEvaluation.findMany({
    where: {
      companyId,
    },
    include: {
      scores: true,
    },
  })

  const byPerson = new Map<string, {
    personId: string
    total: number
    count: number
  }>()

  for (const evaluation of evaluations) {
    const average = getEvaluationAverage(evaluation)
    if (!average) continue

    const current = byPerson.get(evaluation.personId) ?? {
      personId: evaluation.personId,
      total: 0,
      count: 0,
    }

    current.total += average
    current.count += 1
    byPerson.set(evaluation.personId, current)
  }

  return Array.from(byPerson.values()).map((item) => ({
    personId: item.personId,
    average: item.count ? item.total / item.count : 0,
    count: item.count,
  }))
}

export async function getPersonEvaluationSummary(companyId: string, personId: string) {
  const person = await prisma.person.findFirst({
    where: {
      id: personId,
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!person) {
    throw new Error('PERSON_NOT_FOUND')
  }

  const evaluations = await prisma.staffEvaluation.findMany({
    where: {
      companyId,
      personId,
    },
    include: {
      eventDate: true,
      scores: {
        include: {
          criterion: true,
        },
        orderBy: {
          criterion: {
            name: 'asc',
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const byCriterion = new Map<string, {
    criterionId: string
    criterionName: string
    total: number
    count: number
  }>()

  const byFunction = new Map<string, {
    functionName: string
    total: number
    count: number
  }>()

  const byEvent = new Map<string, {
    eventDateId: string
    eventTitle: string
    eventStartAt: string
    eventEndAt?: string | null
    total: number
    count: number
    evaluations: PersonEvaluationWithDetails[]
  }>()

  let overallTotal = 0
  let overallCount = 0

  for (const evaluation of evaluations as unknown as PersonEvaluationWithDetails[]) {
    const evaluationAverage = getEvaluationAverage(evaluation)

    if (evaluationAverage) {
      overallTotal += evaluationAverage
      overallCount += 1
    }

    const functionScore = Number(evaluation.functionScore ?? 0)
    if (Number.isFinite(functionScore) && functionScore > 0) {
      const functionItem = byFunction.get(evaluation.functionName) ?? {
        functionName: evaluation.functionName,
        total: 0,
        count: 0,
      }

      functionItem.total += functionScore
      functionItem.count += 1
      byFunction.set(evaluation.functionName, functionItem)
    }

    const eventDateId = evaluation.eventDateId
    const eventItem = byEvent.get(eventDateId) ?? {
      eventDateId,
      eventTitle: formatEventTitle(evaluation.eventDate),
      eventStartAt: evaluation.eventDate?.startAt?.toISOString?.() ?? String(evaluation.eventDate?.startAt ?? ''),
      eventEndAt: evaluation.eventDate?.endAt
        ? evaluation.eventDate.endAt.toISOString?.() ?? String(evaluation.eventDate.endAt)
        : null,
      total: 0,
      count: 0,
      evaluations: [] as PersonEvaluationWithDetails[],
    }

    if (evaluationAverage) {
      eventItem.total += evaluationAverage
      eventItem.count += 1
    }

    eventItem.evaluations.push(evaluation)
    byEvent.set(eventDateId, eventItem)

    for (const score of evaluation.scores ?? []) {
      const current = byCriterion.get(score.criterionId) ?? {
        criterionId: score.criterionId,
        criterionName: score.criterion.name,
        total: 0,
        count: 0,
      }

      current.total += Number(score.score ?? 0)
      current.count += 1
      byCriterion.set(score.criterionId, current)
    }
  }

  return {
    person,
    totalEvaluations: evaluations.length,
    overallAverage: overallCount ? overallTotal / overallCount : 0,
    averageByCriterion: Array.from(byCriterion.values()).map((item) => ({
      criterionId: item.criterionId,
      criterionName: item.criterionName,
      average: item.count ? item.total / item.count : 0,
      count: item.count,
    })),
    averageByFunction: Array.from(byFunction.values()).map((item) => ({
      functionName: item.functionName,
      average: item.count ? item.total / item.count : 0,
      count: item.count,
    })),
    averageByEvent: Array.from(byEvent.values())
      .sort((a, b) => new Date(b.eventStartAt).getTime() - new Date(a.eventStartAt).getTime())
      .map((item) => ({
      eventDateId: item.eventDateId,
      eventTitle: item.eventTitle,
      eventStartAt: item.eventStartAt,
      eventEndAt: item.eventEndAt,
      average: item.count ? item.total / item.count : 0,
      count: item.count,
      evaluations: item.evaluations,
    })),
    evaluations,
  }
}
