"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomers = listCustomers;
exports.getCustomer = getCustomer;
exports.createCustomer = createCustomer;
exports.updateCustomer = updateCustomer;
exports.deactivateCustomer = deactivateCustomer;
exports.upsertEventCustomerComanda = upsertEventCustomerComanda;
exports.removeEventCustomerComanda = removeEventCustomerComanda;
exports.lookupCustomerByEventComanda = lookupCustomerByEventComanda;
const prisma_1 = require("../lib/prisma");
const db = prisma_1.prisma;
function cleanText(value) {
    return value?.trim() || null;
}
function normalizeSearch(value) {
    return value?.trim() || '';
}
function toPositiveInt(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0)
        return null;
    return number;
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
            createdAt: 'desc',
        },
    },
    _count: {
        select: {
            orders: true,
        },
    },
};
async function listCustomers(input) {
    const search = normalizeSearch(input.search);
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
    });
    const customerIds = customers.map((customer) => customer.id);
    if (customerIds.length === 0)
        return customers;
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
    });
    const totalByCustomerId = new Map(totals.map((row) => [row.customerId, Number(row._sum?.total ?? 0)]));
    return customers.map((customer) => ({
        ...customer,
        totalSpent: totalByCustomerId.get(customer.id) ?? 0,
    }));
}
async function getCustomer(companyId, id) {
    const customer = await db.customer.findFirst({
        where: {
            id,
            companyId,
        },
        include: customerInclude,
    });
    if (!customer)
        throw new Error('CUSTOMER_NOT_FOUND');
    return customer;
}
async function createCustomer(input) {
    if (!input.name?.trim())
        throw new Error('CUSTOMER_NAME_REQUIRED');
    return db.customer.create({
        data: {
            companyId: input.companyId,
            name: input.name.trim(),
            phone: cleanText(input.phone),
            email: cleanText(input.email),
        },
        include: customerInclude,
    });
}
async function updateCustomer(companyId, id, input) {
    const existing = await db.customer.findFirst({
        where: {
            id,
            companyId,
        },
    });
    if (!existing)
        throw new Error('CUSTOMER_NOT_FOUND');
    return db.customer.update({
        where: { id },
        data: {
            name: input.name === undefined ? undefined : input.name.trim(),
            phone: input.phone === undefined ? undefined : cleanText(input.phone),
            email: input.email === undefined ? undefined : cleanText(input.email),
            active: input.active,
        },
        include: customerInclude,
    });
}
async function deactivateCustomer(companyId, id) {
    const existing = await db.customer.findFirst({
        where: {
            id,
            companyId,
        },
    });
    if (!existing)
        throw new Error('CUSTOMER_NOT_FOUND');
    return db.customer.update({
        where: { id },
        data: { active: false },
        include: customerInclude,
    });
}
async function upsertEventCustomerComanda(input) {
    const comandaNumber = toPositiveInt(input.comandaNumber);
    if (!comandaNumber)
        throw new Error('COMANDA_NUMBER_INVALID');
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
    ]);
    if (!eventDate)
        throw new Error('EVENT_DATE_NOT_FOUND');
    if (!customer)
        throw new Error('CUSTOMER_NOT_FOUND');
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
    });
    if (conflictingComanda?.customer?.active) {
        throw new Error('COMANDA_ALREADY_LINKED_TO_ANOTHER_CUSTOMER');
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
        });
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
    });
}
async function removeEventCustomerComanda(input) {
    const existing = await db.eventCustomerComanda.findFirst({
        where: {
            companyId: input.companyId,
            eventDateId: input.eventDateId,
            customerId: input.customerId,
        },
    });
    if (!existing)
        throw new Error('CUSTOMER_COMANDA_NOT_FOUND');
    await db.eventCustomerComanda.delete({
        where: { id: existing.id },
    });
    return { ok: true };
}
async function lookupCustomerByEventComanda(input) {
    const comandaNumber = toPositiveInt(input.comandaNumber);
    if (!comandaNumber)
        throw new Error('COMANDA_NUMBER_INVALID');
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
    });
    if (!link)
        return null;
    return {
        id: link.id,
        customerId: link.customerId,
        eventDateId: link.eventDateId,
        comandaNumber: link.comandaNumber,
        comandaName: link.comandaName ?? link.customer.name,
        customer: link.customer,
        eventDate: link.eventDate,
    };
}
