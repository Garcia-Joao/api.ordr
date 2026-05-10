"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.heartbeatDevice = heartbeatDevice;
exports.listCompanyDevices = listCompanyDevices;
exports.deleteCompanyDevice = deleteCompanyDevice;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
function normalizeDeviceType(value) {
    const normalized = String(value ?? '').toUpperCase();
    if (normalized === 'DESKTOP')
        return 'DESKTOP';
    if (normalized === 'MOBILE')
        return 'MOBILE';
    if (normalized === 'TABLET')
        return 'TABLET';
    return 'UNKNOWN';
}
function normalizeClientType(value) {
    return String(value ?? '').toUpperCase() === 'ELECTRON' ? 'ELECTRON' : 'WEB';
}
function cleanText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
}
function sanitizeLocalPrinters(value) {
    if (!Array.isArray(value))
        return null;
    return value
        .slice(0, 50)
        .map((printer) => ({
        name: cleanText(printer?.name, ''),
        displayName: cleanText(printer?.displayName, '') || null,
        description: cleanText(printer?.description, '') || null,
        isDefault: Boolean(printer?.isDefault),
    }))
        .filter((printer) => printer.name);
}
async function userIsCompanyAdmin(userId, companyId) {
    const membership = await prisma_1.prisma.userCompany.findUnique({
        where: { userId_companyId: { userId, companyId } },
        select: { systemRole: true },
    });
    return membership?.systemRole === 'ADMIN';
}
function getStartOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}
function getDeviceStatus(lastSeenAt) {
    return Date.now() - lastSeenAt.getTime() <= ONLINE_THRESHOLD_MS
        ? 'online'
        : 'offline';
}
async function heartbeatDevice(input) {
    const now = new Date();
    const id = cleanText(input.deviceId, '');
    const clientType = normalizeClientType(input.clientType);
    const requestedPrintTerminal = Boolean(input.isPrintTerminal || input.printTerminalEnabled);
    const canEnablePrintTerminal = clientType === 'ELECTRON' && requestedPrintTerminal
        ? await userIsCompanyAdmin(input.userId, input.companyId)
        : false;
    const baseData = {
        companyId: input.companyId,
        currentUserId: input.userId,
        name: cleanText(input.name, 'Dispositivo sem nome'),
        type: normalizeDeviceType(input.type),
        clientType,
        isPrintTerminal: canEnablePrintTerminal,
        printTerminalEnabled: canEnablePrintTerminal,
        terminalApprovedAt: canEnablePrintTerminal ? now : null,
        localPrinters: clientType === 'ELECTRON' ? sanitizeLocalPrinters(input.localPrinters) ?? client_1.Prisma.JsonNull : client_1.Prisma.JsonNull,
        browser: cleanText(input.browser, '') || null,
        os: cleanText(input.os, '') || null,
        userAgent: cleanText(input.userAgent, '') || null,
        ipAddress: cleanText(input.ipAddress, '') || null,
        lastSeenAt: now,
    };
    const device = id
        ? await prisma_1.prisma.device.upsert({
            where: { id },
            create: {
                id,
                ...baseData,
                firstSeenAt: now,
            },
            update: baseData,
            include: { currentUser: { select: { id: true, username: true, name: true } } },
        })
        : await prisma_1.prisma.device.create({
            data: {
                ...baseData,
                firstSeenAt: now,
            },
            include: { currentUser: { select: { id: true, username: true, name: true } } },
        });
    return {
        id: device.id,
        name: device.name,
        type: device.type,
        clientType: device.clientType,
        isPrintTerminal: device.isPrintTerminal,
        printTerminalEnabled: device.printTerminalEnabled,
        localPrinters: device.localPrinters,
        status: getDeviceStatus(device.lastSeenAt),
        lastSeenAt: device.lastSeenAt.toISOString(),
        currentUser: device.currentUser,
    };
}
async function listCompanyDevices(companyId) {
    const devices = await prisma_1.prisma.device.findMany({
        where: { companyId },
        orderBy: [
            { lastSeenAt: 'desc' },
            { name: 'asc' },
        ],
        include: {
            currentUser: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                },
            },
        },
    });
    const today = getStartOfToday();
    const sales = await prisma_1.prisma.order.groupBy({
        by: ['deviceId'],
        where: {
            companyId,
            deviceId: { not: null },
            status: 'paid',
            createdAt: { gte: today },
        },
        _count: { _all: true },
        _sum: { total: true },
    });
    const salesByDevice = new Map(sales.map((item) => [
        item.deviceId,
        {
            salesCount: item._count._all,
            totalSales: Number(item._sum.total ?? 0),
        },
    ]));
    return devices.map((device) => {
        const deviceSales = salesByDevice.get(device.id) ?? {
            salesCount: 0,
            totalSales: 0,
        };
        return {
            id: device.id,
            name: device.name,
            type: device.type,
            browser: device.browser,
            os: device.os,
            userAgent: device.userAgent,
            ipAddress: device.ipAddress,
            clientType: device.clientType,
            isPrintTerminal: device.isPrintTerminal,
            printTerminalEnabled: device.printTerminalEnabled,
            localPrinters: device.localPrinters,
            terminalApprovedAt: device.terminalApprovedAt?.toISOString() ?? null,
            firstSeenAt: device.firstSeenAt.toISOString(),
            lastSeenAt: device.lastSeenAt.toISOString(),
            status: getDeviceStatus(device.lastSeenAt),
            currentUser: device.currentUser,
            salesCount: deviceSales.salesCount,
            totalSales: deviceSales.totalSales,
        };
    });
}
async function deleteCompanyDevice(params) {
    const membership = await prisma_1.prisma.userCompany.findUnique({
        where: {
            userId_companyId: {
                userId: params.userId,
                companyId: params.companyId,
            },
        },
        select: { systemRole: true },
    });
    if (!membership) {
        throw new Error('COMPANY_ACCESS_DENIED');
    }
    if (membership.systemRole !== 'ADMIN') {
        throw new Error('ADMIN_ACCESS_REQUIRED');
    }
    const device = await prisma_1.prisma.device.findFirst({
        where: {
            id: params.deviceId,
            companyId: params.companyId,
        },
        select: { id: true },
    });
    if (!device) {
        throw new Error('DEVICE_NOT_FOUND');
    }
    await prisma_1.prisma.device.delete({ where: { id: device.id } });
    return { ok: true };
}
