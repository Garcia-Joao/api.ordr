"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesEnvironments = getSalesEnvironments;
exports.createSalesEnvironment = createSalesEnvironment;
exports.deleteSalesEnvironment = deleteSalesEnvironment;
const prisma_1 = require("../lib/prisma");
async function ensureDefaultSalesEnvironment(companyId) {
    let defaultEnvironment = await prisma_1.prisma.salesEnvironment.findFirst({
        where: {
            companyId,
            active: true,
            isDefault: true,
        },
    });
    if (!defaultEnvironment) {
        defaultEnvironment = await prisma_1.prisma.salesEnvironment.create({
            data: {
                companyId,
                name: 'Default',
                color: '#64748B',
                isDefault: true,
                active: true,
            },
        });
    }
    return defaultEnvironment;
}
async function getSalesEnvironments(companyId) {
    await ensureDefaultSalesEnvironment(companyId);
    return prisma_1.prisma.salesEnvironment.findMany({
        where: {
            companyId,
            active: true,
        },
        orderBy: [
            { isDefault: 'desc' },
            { name: 'asc' },
        ],
    });
}
async function createSalesEnvironment(input) {
    if (!input.companyId?.trim()) {
        throw new Error('COMPANY_ID_REQUIRED');
    }
    if (!input.name?.trim()) {
        throw new Error('SALES_ENVIRONMENT_NAME_REQUIRED');
    }
    if (!input.color?.trim()) {
        throw new Error('SALES_ENVIRONMENT_COLOR_REQUIRED');
    }
    await ensureDefaultSalesEnvironment(input.companyId);
    const existing = await prisma_1.prisma.salesEnvironment.findFirst({
        where: {
            companyId: input.companyId,
            name: input.name.trim(),
            active: true,
        },
    });
    if (existing) {
        throw new Error('SALES_ENVIRONMENT_NAME_ALREADY_EXISTS');
    }
    return prisma_1.prisma.salesEnvironment.create({
        data: {
            companyId: input.companyId,
            name: input.name.trim(),
            color: input.color.trim(),
            isDefault: false,
            active: true,
        },
    });
}
async function deleteSalesEnvironment(input) {
    const existing = await prisma_1.prisma.salesEnvironment.findFirst({
        where: {
            id: input.environmentId,
            companyId: input.companyId,
            active: true,
        },
        include: {
            internalCustomers: {
                where: {
                    active: true,
                },
                select: {
                    id: true,
                },
                take: 1,
            },
        },
    });
    if (!existing) {
        throw new Error('SALES_ENVIRONMENT_NOT_FOUND');
    }
    if (existing.isDefault) {
        throw new Error('SALES_ENVIRONMENT_DEFAULT_CANNOT_BE_DELETED');
    }
    if (existing.internalCustomers.length > 0) {
        throw new Error('SALES_ENVIRONMENT_HAS_CUSTOMERS');
    }
    const environment = await prisma_1.prisma.salesEnvironment.update({
        where: {
            id: input.environmentId,
        },
        data: {
            active: false,
        },
    });
    return environment;
}
