"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.heartbeatDevice = heartbeatDevice;
exports.listCompanyDevices = listCompanyDevices;
exports.deleteCompanyDevice = deleteCompanyDevice;
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
    const baseData = {
        companyId: input.companyId,
        currentUserId: input.userId,
        name: cleanText(input.name, 'Dispositivo sem nome'),
        type: normalizeDeviceType(input.type),
        browser: cleanText(input.browser, '') || null,
        os: cleanText(input.os, '') || null,
        userAgent: cleanText(input.userAgent, '') || null,
        ipAddress: cleanText(input.ipAddress, '') || null,
        clientType: normalizeClientType(input.clientType),
        isPrintTerminal: Boolean(input.isPrintTerminal) && normalizeClientType(input.clientType) === 'ELECTRON',
        printTerminalEnabled: Boolean(input.printTerminalEnabled) && normalizeClientType(input.clientType) === 'ELECTRON',
        terminalApprovedAt: Boolean(input.printTerminalEnabled) && normalizeClientType(input.clientType) === 'ELECTRON' ? now : null,
        localPrinters: Array.isArray(input.localPrinters) ? input.localPrinters : undefined,
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
        status: getDeviceStatus(device.lastSeenAt),
        lastSeenAt: device.lastSeenAt.toISOString(),
        currentUser: device.currentUser,
        clientType: device.clientType ?? 'WEB',
        isPrintTerminal: Boolean(device.isPrintTerminal),
        printTerminalEnabled: Boolean(device.printTerminalEnabled),
        localPrinters: device.localPrinters ?? [],
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
            firstSeenAt: device.firstSeenAt.toISOString(),
            lastSeenAt: device.lastSeenAt.toISOString(),
            status: getDeviceStatus(device.lastSeenAt),
            currentUser: device.currentUser,
            clientType: device.clientType ?? 'WEB',
            isPrintTerminal: Boolean(device.isPrintTerminal),
            printTerminalEnabled: Boolean(device.printTerminalEnabled),
            terminalApprovedAt: device.terminalApprovedAt?.toISOString?.() ?? null,
            localPrinters: device.localPrinters ?? [],
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
