"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInternalCustomers = void 0;
exports.listInternalCustomers = listInternalCustomers;
exports.getInternalCustomerTodayOrders = getInternalCustomerTodayOrders;
exports.getInternalCustomerPendingOrders = getInternalCustomerPendingOrders;
exports.updateInternalCustomer = updateInternalCustomer;
exports.deleteInternalCustomer = deleteInternalCustomer;
exports.paySelectedInternalCustomerOrders = paySelectedInternalCustomerOrders;
const prisma_1 = require("../lib/prisma");
const orderInclude = {
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
};
async function customerHasPendingOrders(customerId) {
    const count = await prisma_1.prisma.order.count({
        where: {
            internalCustomerId: customerId,
            status: 'pending',
        },
    });
    return count > 0;
}
async function findInternalCustomerForPdv(customerId) {
    const customer = await prisma_1.prisma.internalCustomer.findUnique({
        where: { id: customerId },
        include: {
            salesEnvironment: true,
        },
    });
    if (!customer) {
        throw new Error('INTERNAL_CUSTOMER_NOT_FOUND');
    }
    if (customer.active) {
        return customer;
    }
    const hasPendingOrders = await customerHasPendingOrders(customerId);
    if (!hasPendingOrders) {
        throw new Error('INTERNAL_CUSTOMER_NOT_FOUND');
    }
    return customer;
}
async function listInternalCustomers() {
    return prisma_1.prisma.internalCustomer.findMany({
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
    });
}
exports.getInternalCustomers = listInternalCustomers;
async function getInternalCustomerTodayOrders(customerId) {
    const customer = await findInternalCustomerForPdv(customerId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const orders = await prisma_1.prisma.order.findMany({
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
    });
    return {
        customer,
        orders,
    };
}
async function getInternalCustomerPendingOrders(customerId) {
    const customer = await findInternalCustomerForPdv(customerId);
    const orders = await prisma_1.prisma.order.findMany({
        where: {
            internalCustomerId: customerId,
            status: 'pending',
        },
        orderBy: {
            createdAt: 'desc',
        },
        include: orderInclude,
    });
    const pendingTotal = orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    return {
        customer,
        orders,
        summary: {
            pendingCount: orders.length,
            pendingTotal,
        },
    };
}
async function updateInternalCustomer(customerId, data) {
    const existing = await prisma_1.prisma.internalCustomer.findUnique({
        where: { id: customerId },
    });
    if (!existing) {
        throw new Error('INTERNAL_CUSTOMER_NOT_FOUND');
    }
    return prisma_1.prisma.internalCustomer.update({
        where: { id: customerId },
        data: {
            name: data.name.trim(),
            phone: data.phone?.trim() || null,
            salesEnvironmentId: data.salesEnvironmentId,
        },
        include: {
            salesEnvironment: true,
        },
    });
}
async function deleteInternalCustomer(customerId) {
    const existing = await prisma_1.prisma.internalCustomer.findUnique({
        where: { id: customerId },
    });
    if (!existing) {
        throw new Error('INTERNAL_CUSTOMER_NOT_FOUND');
    }
    const hasPendingOrders = await customerHasPendingOrders(customerId);
    if (hasPendingOrders) {
        throw new Error('INTERNAL_CUSTOMER_HAS_OPEN_ORDERS');
    }
    await prisma_1.prisma.internalCustomer.update({
        where: { id: customerId },
        data: {
            active: false,
        },
    });
    return { ok: true };
}
async function paySelectedInternalCustomerOrders(customerId, data) {
    await findInternalCustomerForPdv(customerId);
    if (!data.orderIds || data.orderIds.length === 0) {
        throw new Error('NO_ORDERS_SELECTED');
    }
    const paymentMethod = data.paymentMethod;
    await prisma_1.prisma.order.updateMany({
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
    });
    const pendingCount = await prisma_1.prisma.order.count({
        where: {
            internalCustomerId: customerId,
            status: 'pending',
        },
    });
    const customer = await prisma_1.prisma.internalCustomer.findUnique({
        where: { id: customerId },
        select: {
            active: true,
        },
    });
    return {
        ok: true,
        shouldRemoveFromInternalPdv: customer?.active === false && pendingCount === 0,
    };
}
