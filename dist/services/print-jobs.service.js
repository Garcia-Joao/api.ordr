"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrintJob = createPrintJob;
exports.createOrderPrintJobs = createOrderPrintJobs;
exports.createBuyRequestShoppingListPrintJobs = createBuyRequestShoppingListPrintJobs;
exports.listTerminalPendingJobs = listTerminalPendingJobs;
exports.claimPrintJob = claimPrintJob;
exports.updatePrintJobStatus = updatePrintJobStatus;
exports.deletePrintJob = deletePrintJob;
const prisma_1 = require("../lib/prisma");
const printers_service_1 = require("./printers.service");
const ONLINE_THRESHOLD_MS = 45 * 1000;
function isTerminalOnline(device) {
    if (!device?.lastSeenAt)
        return false;
    return Date.now() - new Date(device.lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS;
}
function normalizeJob(job) {
    return {
        id: job.id,
        companyId: job.companyId,
        orderId: job.orderId,
        portId: job.portId,
        terminalDeviceId: job.terminalDeviceId,
        type: job.type,
        status: job.status,
        payload: job.payload,
        attempts: job.attempts,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt?.toISOString?.() ?? job.createdAt,
        claimedAt: job.claimedAt?.toISOString?.() ?? job.claimedAt,
        printedAt: job.printedAt?.toISOString?.() ?? job.printedAt,
        failedAt: job.failedAt?.toISOString?.() ?? job.failedAt,
        port: job.port
            ? {
                id: job.port.id,
                name: job.port.name,
                localPrinterName: job.port.localPrinterName,
                localPrinterLabel: job.port.localPrinterLabel,
                paperWidth: job.port.paperWidth,
                terminalDeviceId: job.port.terminalDeviceId,
                bindings: (job.port.bindings ?? []).map((binding) => ({
                    id: binding.id,
                    portId: binding.portId,
                    terminalDeviceId: binding.terminalDeviceId,
                    localPrinterName: binding.localPrinterName,
                    localPrinterLabel: binding.localPrinterLabel ?? binding.localPrinterName,
                })),
            }
            : null,
        order: job.order ? { id: job.order.id, comanda: job.order.comanda, comandaName: job.order.comandaName } : null,
    };
}
async function getPortForJob(companyId, portId) {
    if (!portId)
        return null;
    const port = await prisma_1.prisma.printPort.findFirst({
        where: { id: portId, companyId, active: true },
        include: { terminalDevice: true, bindings: { include: { terminalDevice: true } } },
    });
    if (!port)
        throw new Error('PRINT_PORT_NOT_FOUND');
    const hasAvailableBinding = (port.bindings ?? []).some((binding) => binding.terminalDevice?.printTerminalEnabled &&
        binding.terminalDevice?.clientType === 'ELECTRON' &&
        isTerminalOnline(binding.terminalDevice));
    if (!hasAvailableBinding)
        throw new Error('PRINT_PORT_NOT_BOUND');
    return port;
}
async function createPrintJob(input) {
    const port = await getPortForJob(input.companyId, input.portId);
    const job = await prisma_1.prisma.printJob.create({
        data: {
            companyId: input.companyId,
            orderId: input.orderId || null,
            portId: port?.id ?? input.portId ?? null,
            terminalDeviceId: (port?.bindings ?? [])[0]?.terminalDeviceId ?? port?.terminalDeviceId ?? null,
            type: input.type ?? 'ORDER_TICKET',
            payload: input.payload,
        },
        include: { port: { include: { bindings: true } }, order: true },
    });
    return normalizeJob(job);
}
function getOrderItemPrintKey(item) {
    const optionIds = (item.variations ?? [])
        .flatMap((selection) => (selection.options ?? []).map((selected) => selected.optionId))
        .filter(Boolean)
        .sort();
    return `${item.productId}-${JSON.stringify(optionIds)}`;
}
function normalizeOrderItemForPayload(item, quantityOverride) {
    const quantity = quantityOverride ?? Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? 0);
    return {
        name: item.product?.name ?? 'Item',
        quantity,
        unitPrice,
        totalPrice: Number((unitPrice * quantity).toFixed(2)),
        notes: item.notes ?? null,
        productId: item.productId,
        categoryName: item.product?.category?.name ?? null,
        variations: (item.variations ?? []).flatMap((selection) => (selection.options ?? []).map((option) => option.option?.name).filter(Boolean)),
    };
}
function buildSeparateTicketsForItem(item) {
    const quantity = Number(item.quantity ?? 1);
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
    return Array.from({ length: Math.max(1, safeQuantity) }, () => ({
        mode: 'SEPARATE',
        items: [normalizeOrderItemForPayload(item, 1)],
    }));
}
function buildTicketsForPortItems(itemsWithModes) {
    const tickets = [];
    const groupedItems = [];
    for (const { item, mode } of itemsWithModes) {
        if (mode === 'GROUPED') {
            groupedItems.push(normalizeOrderItemForPayload(item));
            continue;
        }
        tickets.push(...buildSeparateTicketsForItem(item));
    }
    if (groupedItems.length > 0) {
        tickets.unshift({
            mode: 'GROUPED',
            items: groupedItems,
        });
    }
    return tickets;
}
function buildOrderPayload(order, port, tickets, template) {
    const flattenedItems = tickets.flatMap((ticket) => ticket.items ?? []);
    return {
        kind: 'ORDER_TICKET',
        title: 'Pedido',
        orderId: order.id,
        comanda: order.comanda,
        comandaName: order.comandaName ?? null,
        observation: order.observation ?? null,
        createdAt: order.createdAt,
        port: port ? { id: port.id, name: port.name } : null,
        tickets,
        items: flattenedItems,
        template: template?.orderTicket?.config ?? null,
    };
}
async function createOrderPrintJobs(companyId, orderId, options = {}) {
    const printTemplates = await (0, printers_service_1.getPrintTemplates)(companyId);
    const order = await prisma_1.prisma.order.findFirst({
        where: { id: orderId, companyId },
        include: {
            items: {
                include: {
                    product: { include: { category: true, printPort: true } },
                    variations: { include: { options: { include: { option: true } } } },
                },
            },
        },
    });
    if (!order)
        throw new Error('ORDER_NOT_FOUND');
    const defaultPort = await prisma_1.prisma.printPort.findFirst({
        where: { companyId, active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { bindings: { include: { terminalDevice: true } } },
    });
    const portIds = new Set();
    const itemsByPort = new Map();
    for (const item of order.items) {
        const productPortId = item.product?.printPortId ?? null;
        const categoryPortId = item.product?.category?.printPortId ?? null;
        const resolvedPortId = productPortId || categoryPortId || defaultPort?.id || 'unassigned';
        const itemKey = getOrderItemPrintKey(item);
        const mode = options.itemPrintModes?.get(itemKey) ?? 'SEPARATE';
        portIds.add(resolvedPortId);
        itemsByPort.set(resolvedPortId, [
            ...(itemsByPort.get(resolvedPortId) ?? []),
            { item, mode },
        ]);
    }
    const ports = await prisma_1.prisma.printPort.findMany({
        where: { id: { in: Array.from(portIds).filter((id) => id !== 'unassigned') }, companyId, active: true },
        include: { bindings: { include: { terminalDevice: true } } },
    });
    const portsById = new Map(ports.map((port) => [port.id, port]));
    const jobs = [];
    for (const [portId, itemsWithModes] of itemsByPort.entries()) {
        const port = portsById.get(portId) ?? null;
        const tickets = buildTicketsForPortItems(itemsWithModes);
        const bindings = (port?.bindings ?? []).filter((binding) => binding.terminalDevice?.printTerminalEnabled &&
            binding.terminalDevice?.clientType === 'ELECTRON' &&
            isTerminalOnline(binding.terminalDevice));
        if (!port || bindings.length === 0) {
            jobs.push(await prisma_1.prisma.printJob.create({
                data: {
                    companyId,
                    orderId: order.id,
                    portId: port?.id ?? null,
                    terminalDeviceId: null,
                    status: 'FAILED',
                    errorMessage: port ? 'PRINT_PORT_NOT_BOUND' : 'PRINT_PORT_NOT_FOUND',
                    payload: buildOrderPayload(order, port, tickets, printTemplates),
                },
                include: { port: { include: { bindings: true } }, order: true },
            }));
            continue;
        }
        const uniqueTerminalIds = Array.from(new Set(bindings.map((binding) => binding.terminalDeviceId)));
        for (const terminalDeviceId of uniqueTerminalIds) {
            jobs.push(await prisma_1.prisma.printJob.create({
                data: {
                    companyId,
                    orderId: order.id,
                    portId: port.id,
                    terminalDeviceId,
                    status: 'PENDING',
                    errorMessage: null,
                    payload: buildOrderPayload(order, port, tickets, printTemplates),
                },
                include: { port: { include: { bindings: true } }, order: true },
            }));
        }
    }
    return jobs.map(normalizeJob);
}
function normalizeUnitLabel(unit) {
    if (!unit || unit === 'unit')
        return '';
    if (unit === 'g')
        return 'gr';
    return unit;
}
function formatChecklistQuantity(value, unit) {
    const formatted = Number(value ?? 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
    const unitLabel = normalizeUnitLabel(unit);
    return unitLabel ? `${formatted}${unitLabel}` : formatted;
}
function buildBuyListPayload(request, port, template) {
    return {
        kind: 'BUY_LIST',
        title: 'Lista de Compras',
        buyRequestId: request.id,
        buyRequestTitle: request.title?.trim() || 'Compra',
        supplierName: request.supplierName?.trim() || null,
        notes: request.notes?.trim() || null,
        eventName: request.eventDate?.title ?? null,
        createdAt: new Date().toISOString(),
        requestCreatedAt: request.createdAt,
        port: port ? { id: port.id, name: port.name } : null,
        template: template?.buyList?.config ?? null,
        items: (request.items ?? []).map((item) => ({
            name: item.product?.name ?? 'Item',
            productId: item.productId,
            quantity: Number(item.requestedQuantity ?? 0),
            unit: item.product?.stockUnit ?? 'unit',
            quantityLabel: formatChecklistQuantity(Number(item.requestedQuantity ?? 0), item.product?.stockUnit ?? 'unit'),
            categoryName: item.product?.category?.name ?? null,
            notes: item.notes ?? null,
            checklist: true,
        })),
    };
}
async function createBuyRequestShoppingListPrintJobs(input) {
    const printTemplates = await (0, printers_service_1.getPrintTemplates)(input.companyId);
    const request = await prisma_1.prisma.buyRequest.findFirst({
        where: {
            id: input.buyRequestId,
            companyId: input.companyId,
        },
        include: {
            eventDate: true,
            items: {
                include: {
                    product: {
                        include: {
                            category: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'asc',
                },
            },
        },
    });
    if (!request)
        throw new Error('BUY_REQUEST_NOT_FOUND');
    const port = input.portId
        ? await prisma_1.prisma.printPort.findFirst({
            where: {
                id: input.portId,
                companyId: input.companyId,
                active: true,
            },
            include: {
                bindings: {
                    include: {
                        terminalDevice: true,
                    },
                },
            },
        })
        : await prisma_1.prisma.printPort.findFirst({
            where: {
                companyId: input.companyId,
                active: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
                bindings: {
                    include: {
                        terminalDevice: true,
                    },
                },
            },
        });
    if (!port) {
        const failedJob = await prisma_1.prisma.printJob.create({
            data: {
                companyId: input.companyId,
                orderId: null,
                portId: null,
                terminalDeviceId: null,
                type: 'BUY_LIST',
                status: 'FAILED',
                errorMessage: 'PRINT_PORT_NOT_FOUND',
                payload: buildBuyListPayload(request, null, printTemplates),
            },
            include: { port: { include: { bindings: true } }, order: true },
        });
        return [normalizeJob(failedJob)];
    }
    const bindings = (port.bindings ?? []).filter((binding) => binding.terminalDevice?.printTerminalEnabled &&
        binding.terminalDevice?.clientType === 'ELECTRON' &&
        isTerminalOnline(binding.terminalDevice));
    if (bindings.length === 0) {
        const failedJob = await prisma_1.prisma.printJob.create({
            data: {
                companyId: input.companyId,
                orderId: null,
                portId: port.id,
                terminalDeviceId: null,
                type: 'BUY_LIST',
                status: 'FAILED',
                errorMessage: 'PRINT_PORT_NOT_BOUND',
                payload: buildBuyListPayload(request, port, printTemplates),
            },
            include: { port: { include: { bindings: true } }, order: true },
        });
        return [normalizeJob(failedJob)];
    }
    const uniqueTerminalIds = Array.from(new Set(bindings.map((binding) => binding.terminalDeviceId)));
    const jobs = [];
    for (const terminalDeviceId of uniqueTerminalIds) {
        jobs.push(await prisma_1.prisma.printJob.create({
            data: {
                companyId: input.companyId,
                orderId: null,
                portId: port.id,
                terminalDeviceId,
                type: 'BUY_LIST',
                status: 'PENDING',
                errorMessage: null,
                payload: buildBuyListPayload(request, port, printTemplates),
            },
            include: { port: { include: { bindings: true } }, order: true },
        }));
    }
    return jobs.map(normalizeJob);
}
async function listTerminalPendingJobs(companyId, terminalDeviceId) {
    const terminal = await prisma_1.prisma.device.findFirst({
        where: {
            id: terminalDeviceId,
            companyId,
            clientType: 'ELECTRON',
            isPrintTerminal: true,
            printTerminalEnabled: true,
        },
        select: { id: true },
    });
    if (!terminal)
        throw new Error('PRINT_TERMINAL_NOT_FOUND');
    const jobs = await prisma_1.prisma.printJob.findMany({
        where: {
            companyId,
            terminalDeviceId,
            status: { in: ['PENDING', 'CLAIMED'] },
        },
        include: { port: { include: { bindings: true } }, order: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
    });
    return jobs.map(normalizeJob);
}
async function claimPrintJob(companyId, terminalDeviceId, jobId) {
    const job = await prisma_1.prisma.printJob.findFirst({
        where: { id: jobId, companyId, terminalDeviceId, status: 'PENDING' },
    });
    if (!job)
        throw new Error('PRINT_JOB_NOT_FOUND');
    const updated = await prisma_1.prisma.printJob.update({
        where: { id: jobId },
        data: { status: 'CLAIMED', claimedAt: new Date(), attempts: { increment: 1 } },
        include: { port: { include: { bindings: true } }, order: true },
    });
    return normalizeJob(updated);
}
async function updatePrintJobStatus(companyId, terminalDeviceId, jobId, status, errorMessage) {
    const job = await prisma_1.prisma.printJob.findFirst({ where: { id: jobId, companyId, terminalDeviceId } });
    if (!job)
        throw new Error('PRINT_JOB_NOT_FOUND');
    if (status === 'PRINTED') {
        const deleted = await prisma_1.prisma.printJob.delete({
            where: { id: jobId },
            include: { port: { include: { bindings: true } }, order: true },
        });
        return normalizeJob({ ...deleted, status: 'PRINTED', printedAt: new Date() });
    }
    const now = new Date();
    const updated = await prisma_1.prisma.printJob.update({
        where: { id: jobId },
        data: {
            status,
            errorMessage: errorMessage ?? null,
            ...(status === 'PRINTING' ? { startedAt: now } : {}),
            ...(status === 'FAILED' ? { failedAt: now } : {}),
        },
        include: { port: { include: { bindings: true } }, order: true },
    });
    return normalizeJob(updated);
}
async function deletePrintJob(companyId, terminalDeviceId, jobId) {
    const job = await prisma_1.prisma.printJob.findFirst({
        where: {
            id: jobId,
            companyId,
            terminalDeviceId,
            status: { in: ['PENDING', 'CLAIMED', 'FAILED', 'CANCELLED'] },
        },
        include: { port: { include: { bindings: true } }, order: true },
    });
    if (!job)
        throw new Error('PRINT_JOB_NOT_FOUND');
    await prisma_1.prisma.printJob.delete({ where: { id: jobId } });
    return normalizeJob({ ...job, status: 'CANCELLED' });
}
