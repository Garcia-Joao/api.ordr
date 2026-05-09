import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type PersonFunctionInput = {
    functionId: string
    detail?: string | null
}

type SavePersonInput = {
    name: string
    phone?: string | null
    email?: string | null
    city?: string | null
    contractType: 'CLT' | 'FREELANCER' | 'PJ' | 'NONE' | 'OTHER'
    salesEnvironmentId?: string | null
    rateType: 'HOURLY' | 'DAILY' | 'EVENT' | 'MONTHLY' | 'NEGOTIABLE'
    rateAmount?: number | null
    rating?: number | null
    observations?: string | null
    active?: boolean
    functions?: PersonFunctionInput[]
}

const DEFAULT_PERSON_FUNCTIONS = [
    'Barman',
    'Garçom',
    'Caixa',
    'Cozinha',
    'Músico',
    'Técnico de som',
    'Técnico de luz',
    'Manutenção',
    'Segurança',
    'Limpeza',
    'Produção',
    'Fotógrafo',
    'DJ',
]

async function getDefaultCompanyId() {
    const company = await prisma.company.findFirst({
        orderBy: {
            createdAt: 'asc',
        },
        select: {
            id: true,
        },
    })

    if (!company) {
        throw new Error('COMPANY_NOT_FOUND')
    }

    return company.id
}

async function getDefaultSalesEnvironmentId(companyId: string) {
    const salesEnvironment = await prisma.salesEnvironment.findFirst({
        where: { companyId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
    })

    if (!salesEnvironment) {
        throw new Error('SALES_ENVIRONMENT_NOT_FOUND')
    }

    return salesEnvironment.id
}

async function ensureDefaultPersonFunctions() {
    for (const name of DEFAULT_PERSON_FUNCTIONS) {
        await prisma.personFunction.upsert({
            where: { name },
            update: {
                active: true,
            },
            create: {
                name,
                active: true,
            },
        })
    }
}

function normalizePersonPayload(data: SavePersonInput) {
    if (!data.name?.trim()) {
        throw new Error('PERSON_NAME_REQUIRED')
    }

    return {
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        city: data.city?.trim() || null,
        contractType: data.contractType ?? 'NONE',
        salesEnvironmentId: data.salesEnvironmentId || null,
        rateType: data.rateType ?? 'EVENT',
        rateAmount:
            data.rateAmount == null || Number.isNaN(Number(data.rateAmount))
                ? null
                : new Prisma.Decimal(Number(data.rateAmount)),
        rating: null,
        observations: data.observations?.trim() || null,
        active: data.active ?? true,
    }
}

async function createOrUpdateInternalCustomerForPerson(params: {
    internalCustomerId?: string | null
    name: string
    phone?: string | null
    salesEnvironmentId?: string | null
    active: boolean
}) {
    const { internalCustomerId, name, phone, salesEnvironmentId, active } = params

    if (!active) {
        return internalCustomerId ?? null
    }

    if (internalCustomerId) {
        const updateData: Prisma.InternalCustomerUncheckedUpdateInput = {
            name,
            phone: phone ?? null,
        }

        if (salesEnvironmentId) {
            updateData.salesEnvironmentId = salesEnvironmentId
        }

        const updated = await prisma.internalCustomer.update({
            where: { id: internalCustomerId },
            data: updateData,
        })

        return updated.id
    }

    const companyId = await getDefaultCompanyId()
    const finalSalesEnvironmentId =
        salesEnvironmentId || (await getDefaultSalesEnvironmentId(companyId))

    const createData: Prisma.InternalCustomerUncheckedCreateInput = {
        companyId,
        name,
        phone: phone ?? null,
        salesEnvironmentId: finalSalesEnvironmentId,
    }

    const created = await prisma.internalCustomer.create({
        data: createData,
    })

    return created.id
}

export async function listPeople() {
    return prisma.person.findMany({
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        include: {
            salesEnvironment: true,
            internalCustomer: true,
            functions: {
                include: {
                    function: true,
                },
            },
        },
    })
}

export async function listPersonFunctions() {
    await ensureDefaultPersonFunctions()

    return prisma.personFunction.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
    })
}

export async function createPersonFunction(data: {
    name: string
    description?: string | null
}) {
    const name = data.name?.trim()

    if (!name) {
        throw new Error('PERSON_FUNCTION_NAME_REQUIRED')
    }

    return prisma.personFunction.upsert({
        where: { name },
        update: {
            active: true,
            description: data.description?.trim() || null,
        },
        create: {
            name,
            description: data.description?.trim() || null,
            active: true,
        },
    })
}

export async function createPerson(data: SavePersonInput) {
    const payload = normalizePersonPayload(data)
    const functions = data.functions ?? []

    const person = await prisma.person.create({
        data: {
            ...payload,
            functions: {
                create: functions
                    .filter((item) => item.functionId)
                    .map((item) => ({
                        functionId: item.functionId,
                        detail: item.detail?.trim() || null,
                    })),
            },
        },
        include: {
            functions: {
                include: {
                    function: true,
                },
            },
            salesEnvironment: true,
            internalCustomer: true,
        },
    })

    const internalCustomerId = await createOrUpdateInternalCustomerForPerson({
        internalCustomerId: person.internalCustomerId,
        name: person.name,
        phone: person.phone,
        salesEnvironmentId: person.salesEnvironmentId,
        active: person.active,
    })

    return prisma.person.update({
        where: { id: person.id },
        data: { internalCustomerId },
        include: {
            functions: {
                include: {
                    function: true,
                },
            },
            salesEnvironment: true,
            internalCustomer: true,
        },
    })
}

export async function updatePerson(personId: string, data: SavePersonInput) {
    const existing = await prisma.person.findUnique({
        where: { id: personId },
    })

    if (!existing) {
        throw new Error('PERSON_NOT_FOUND')
    }

    const payload = normalizePersonPayload(data)
    const functions = data.functions ?? []

    const internalCustomerId = await createOrUpdateInternalCustomerForPerson({
        internalCustomerId: existing.internalCustomerId,
        name: payload.name,
        phone: payload.phone,
        salesEnvironmentId: payload.salesEnvironmentId,
        active: payload.active,
    })

    await prisma.personFunctionAssignment.deleteMany({
        where: { personId },
    })

    return prisma.person.update({
        where: { id: personId },
        data: {
            ...payload,
            internalCustomerId,
            functions: {
                create: functions
                    .filter((item) => item.functionId)
                    .map((item) => ({
                        functionId: item.functionId,
                        detail: item.detail?.trim() || null,
                    })),
            },
        },
        include: {
            functions: {
                include: {
                    function: true,
                },
            },
            salesEnvironment: true,
            internalCustomer: true,
        },
    })
}

export async function disablePerson(personId: string) {
    const existing = await prisma.person.findUnique({
        where: { id: personId },
    })

    if (!existing) {
        throw new Error('PERSON_NOT_FOUND')
    }

    const internalCleanup = await removeInternalCustomerFromPdvIfSafe(
        existing.internalCustomerId
    )

    await prisma.person.update({
        where: { id: personId },
        data: {
            active: false,
        },
    })

    return {
        ok: true,
        ...internalCleanup,
    }
}

export async function restorePerson(personId: string) {
    const existing = await prisma.person.findUnique({
        where: { id: personId },
    })

    if (!existing) {
        throw new Error('PERSON_NOT_FOUND')
    }

    await prisma.person.update({
        where: { id: personId },
        data: {
            active: true,
        },
    })

    if (existing.internalCustomerId) {
        await prisma.internalCustomer.update({
            where: { id: existing.internalCustomerId },
            data: {
                active: true,
            },
        })
    } else {
        const restored = await prisma.person.findUnique({
            where: { id: personId },
        })

        if (restored) {
            const internalCustomerId = await createOrUpdateInternalCustomerForPerson({
                internalCustomerId: restored.internalCustomerId,
                name: restored.name,
                phone: restored.phone,
                salesEnvironmentId: restored.salesEnvironmentId,
                active: true,
            })

            await prisma.person.update({
                where: { id: personId },
                data: { internalCustomerId },
            })
        }
    }

    return { ok: true }
}

export async function deletePerson(personId: string) {
    const existing = await prisma.person.findUnique({
        where: { id: personId },
    })

    if (!existing) {
        throw new Error('PERSON_NOT_FOUND')
    }

    if (existing.active) {
        throw new Error('PERSON_MUST_BE_DISABLED_BEFORE_DELETE')
    }

    const internalCleanup = await removeInternalCustomerFromPdvIfSafe(
        existing.internalCustomerId
    )

    if (internalCleanup.hasOpenOrders) {
        throw new Error('PERSON_HAS_OPEN_INTERNAL_ORDERS')
    }

    await prisma.person.delete({
        where: { id: personId },
    })

    return {
        ok: true,
        ...internalCleanup,
    }
}
async function getInternalCustomerPendingOrdersCount(internalCustomerId: string) {
    return prisma.order.count({
        where: {
            internalCustomerId,
            status: 'pending',
        },
    })
}

async function removeInternalCustomerFromPdvIfSafe(
  internalCustomerId?: string | null
) {
  if (!internalCustomerId) {
    return {
      removedFromInternalPdv: false,
      hasOpenOrders: false,
    }
  }

  const pendingOrdersCount =
    await getInternalCustomerPendingOrdersCount(internalCustomerId)

  await prisma.internalCustomer.update({
    where: { id: internalCustomerId },
    data: {
      active: false,
    },
  })

  return {
    removedFromInternalPdv: pendingOrdersCount <= 0,
    hasOpenOrders: pendingOrdersCount > 0,
  }
}

