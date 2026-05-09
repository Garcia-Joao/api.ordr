"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPeople = listPeople;
exports.listPersonFunctions = listPersonFunctions;
exports.createPersonFunction = createPersonFunction;
exports.createPerson = createPerson;
exports.updatePerson = updatePerson;
exports.disablePerson = disablePerson;
exports.restorePerson = restorePerson;
exports.deletePerson = deletePerson;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
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
];
async function getDefaultCompanyId() {
    const company = await prisma_1.prisma.company.findFirst({
        orderBy: {
            createdAt: 'asc',
        },
        select: {
            id: true,
        },
    });
    if (!company) {
        throw new Error('COMPANY_NOT_FOUND');
    }
    return company.id;
}
async function getDefaultSalesEnvironmentId(companyId) {
    const salesEnvironment = await prisma_1.prisma.salesEnvironment.findFirst({
        where: { companyId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
    });
    if (!salesEnvironment) {
        throw new Error('SALES_ENVIRONMENT_NOT_FOUND');
    }
    return salesEnvironment.id;
}
async function ensureDefaultPersonFunctions() {
    for (const name of DEFAULT_PERSON_FUNCTIONS) {
        await prisma_1.prisma.personFunction.upsert({
            where: { name },
            update: {
                active: true,
            },
            create: {
                name,
                active: true,
            },
        });
    }
}
function normalizePersonPayload(data) {
    if (!data.name?.trim()) {
        throw new Error('PERSON_NAME_REQUIRED');
    }
    return {
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        city: data.city?.trim() || null,
        contractType: data.contractType ?? 'NONE',
        salesEnvironmentId: data.salesEnvironmentId || null,
        rateType: data.rateType ?? 'EVENT',
        rateAmount: data.rateAmount == null || Number.isNaN(Number(data.rateAmount))
            ? null
            : new client_1.Prisma.Decimal(Number(data.rateAmount)),
        rating: null,
        observations: data.observations?.trim() || null,
        active: data.active ?? true,
    };
}
async function createOrUpdateInternalCustomerForPerson(params) {
    const { internalCustomerId, name, phone, salesEnvironmentId, active } = params;
    if (!active) {
        return internalCustomerId ?? null;
    }
    if (internalCustomerId) {
        const updateData = {
            name,
            phone: phone ?? null,
        };
        if (salesEnvironmentId) {
            updateData.salesEnvironmentId = salesEnvironmentId;
        }
        const updated = await prisma_1.prisma.internalCustomer.update({
            where: { id: internalCustomerId },
            data: updateData,
        });
        return updated.id;
    }
    const companyId = await getDefaultCompanyId();
    const finalSalesEnvironmentId = salesEnvironmentId || (await getDefaultSalesEnvironmentId(companyId));
    const createData = {
        companyId,
        name,
        phone: phone ?? null,
        salesEnvironmentId: finalSalesEnvironmentId,
    };
    const created = await prisma_1.prisma.internalCustomer.create({
        data: createData,
    });
    return created.id;
}
async function listPeople() {
    return prisma_1.prisma.person.findMany({
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
    });
}
async function listPersonFunctions() {
    await ensureDefaultPersonFunctions();
    return prisma_1.prisma.personFunction.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
    });
}
async function createPersonFunction(data) {
    const name = data.name?.trim();
    if (!name) {
        throw new Error('PERSON_FUNCTION_NAME_REQUIRED');
    }
    return prisma_1.prisma.personFunction.upsert({
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
    });
}
async function createPerson(data) {
    const payload = normalizePersonPayload(data);
    const functions = data.functions ?? [];
    const person = await prisma_1.prisma.person.create({
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
    });
    const internalCustomerId = await createOrUpdateInternalCustomerForPerson({
        internalCustomerId: person.internalCustomerId,
        name: person.name,
        phone: person.phone,
        salesEnvironmentId: person.salesEnvironmentId,
        active: person.active,
    });
    return prisma_1.prisma.person.update({
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
    });
}
async function updatePerson(personId, data) {
    const existing = await prisma_1.prisma.person.findUnique({
        where: { id: personId },
    });
    if (!existing) {
        throw new Error('PERSON_NOT_FOUND');
    }
    const payload = normalizePersonPayload(data);
    const functions = data.functions ?? [];
    const internalCustomerId = await createOrUpdateInternalCustomerForPerson({
        internalCustomerId: existing.internalCustomerId,
        name: payload.name,
        phone: payload.phone,
        salesEnvironmentId: payload.salesEnvironmentId,
        active: payload.active,
    });
    await prisma_1.prisma.personFunctionAssignment.deleteMany({
        where: { personId },
    });
    return prisma_1.prisma.person.update({
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
    });
}
async function disablePerson(personId) {
    const existing = await prisma_1.prisma.person.findUnique({
        where: { id: personId },
    });
    if (!existing) {
        throw new Error('PERSON_NOT_FOUND');
    }
    const internalCleanup = await removeInternalCustomerFromPdvIfSafe(existing.internalCustomerId);
    await prisma_1.prisma.person.update({
        where: { id: personId },
        data: {
            active: false,
        },
    });
    return {
        ok: true,
        ...internalCleanup,
    };
}
async function restorePerson(personId) {
    const existing = await prisma_1.prisma.person.findUnique({
        where: { id: personId },
    });
    if (!existing) {
        throw new Error('PERSON_NOT_FOUND');
    }
    await prisma_1.prisma.person.update({
        where: { id: personId },
        data: {
            active: true,
        },
    });
    if (existing.internalCustomerId) {
        await prisma_1.prisma.internalCustomer.update({
            where: { id: existing.internalCustomerId },
            data: {
                active: true,
            },
        });
    }
    else {
        const restored = await prisma_1.prisma.person.findUnique({
            where: { id: personId },
        });
        if (restored) {
            const internalCustomerId = await createOrUpdateInternalCustomerForPerson({
                internalCustomerId: restored.internalCustomerId,
                name: restored.name,
                phone: restored.phone,
                salesEnvironmentId: restored.salesEnvironmentId,
                active: true,
            });
            await prisma_1.prisma.person.update({
                where: { id: personId },
                data: { internalCustomerId },
            });
        }
    }
    return { ok: true };
}
async function deletePerson(personId) {
    const existing = await prisma_1.prisma.person.findUnique({
        where: { id: personId },
    });
    if (!existing) {
        throw new Error('PERSON_NOT_FOUND');
    }
    if (existing.active) {
        throw new Error('PERSON_MUST_BE_DISABLED_BEFORE_DELETE');
    }
    const internalCleanup = await removeInternalCustomerFromPdvIfSafe(existing.internalCustomerId);
    if (internalCleanup.hasOpenOrders) {
        throw new Error('PERSON_HAS_OPEN_INTERNAL_ORDERS');
    }
    await prisma_1.prisma.person.delete({
        where: { id: personId },
    });
    return {
        ok: true,
        ...internalCleanup,
    };
}
async function getInternalCustomerPendingOrdersCount(internalCustomerId) {
    return prisma_1.prisma.order.count({
        where: {
            internalCustomerId,
            status: 'pending',
        },
    });
}
async function removeInternalCustomerFromPdvIfSafe(internalCustomerId) {
    if (!internalCustomerId) {
        return {
            removedFromInternalPdv: false,
            hasOpenOrders: false,
        };
    }
    const pendingOrdersCount = await getInternalCustomerPendingOrdersCount(internalCustomerId);
    await prisma_1.prisma.internalCustomer.update({
        where: { id: internalCustomerId },
        data: {
            active: false,
        },
    });
    return {
        removedFromInternalPdv: pendingOrdersCount <= 0,
        hasOpenOrders: pendingOrdersCount > 0,
    };
}
