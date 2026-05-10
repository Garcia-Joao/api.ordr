"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemPrinters = getSystemPrinters;
exports.getPrintTerminals = getPrintTerminals;
exports.listPrintPorts = listPrintPorts;
exports.createPrintPort = createPrintPort;
exports.updatePrintPort = updatePrintPort;
exports.deletePrintPort = deletePrintPort;
exports.bindPrintPort = bindPrintPort;
exports.getPrinterSettings = getPrinterSettings;
exports.savePrinterSettings = savePrinterSettings;
exports.testPrinter = testPrinter;
exports.getSelectedOrderPrinter = getSelectedOrderPrinter;
exports.getOrderTicketTemplate = getOrderTicketTemplate;
exports.getSelectedOrderPrinterName = getSelectedOrderPrinterName;
const prisma_1 = require("../lib/prisma");
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const { listGenericTextPrinters, printRawThermalText, } = require('../../printer.js');
function cleanText(value) {
    const text = String(value ?? '').trim();
    return text || null;
}
function isOnline(value) {
    if (!value)
        return false;
    return Date.now() - value.getTime() <= ONLINE_THRESHOLD_MS;
}
function normalizePort(port) {
    return {
        id: port.id,
        companyId: port.companyId,
        name: port.name,
        description: port.description ?? null,
        active: Boolean(port.active),
        sortOrder: Number(port.sortOrder ?? 0),
        terminalDeviceId: port.terminalDeviceId ?? null,
        localPrinterName: port.localPrinterName ?? null,
        localPrinterLabel: port.localPrinterLabel ?? null,
        paperWidth: port.paperWidth ?? null,
        createdAt: port.createdAt?.toISOString?.() ?? port.createdAt,
        updatedAt: port.updatedAt?.toISOString?.() ?? port.updatedAt,
        terminalDevice: port.terminalDevice
            ? {
                id: port.terminalDevice.id,
                name: port.terminalDevice.name,
                clientType: port.terminalDevice.clientType,
                isPrintTerminal: port.terminalDevice.isPrintTerminal,
                printTerminalEnabled: port.terminalDevice.printTerminalEnabled,
                localPrinters: port.terminalDevice.localPrinters ?? [],
                lastSeenAt: port.terminalDevice.lastSeenAt?.toISOString?.() ?? port.terminalDevice.lastSeenAt,
                status: isOnline(port.terminalDevice.lastSeenAt) ? 'online' : 'offline',
                currentUser: port.terminalDevice.currentUser ?? null,
            }
            : null,
    };
}
function normalizeTerminal(device) {
    return {
        id: device.id,
        name: device.name,
        type: device.type,
        clientType: device.clientType,
        isPrintTerminal: device.isPrintTerminal,
        printTerminalEnabled: device.printTerminalEnabled,
        terminalApprovedAt: device.terminalApprovedAt?.toISOString?.() ?? null,
        localPrinters: device.localPrinters ?? [],
        browser: device.browser,
        os: device.os,
        ipAddress: device.ipAddress,
        lastSeenAt: device.lastSeenAt?.toISOString?.() ?? device.lastSeenAt,
        status: isOnline(device.lastSeenAt) ? 'online' : 'offline',
        currentUser: device.currentUser ?? null,
    };
}
async function assertPortDevice(companyId, terminalDeviceId) {
    if (!terminalDeviceId)
        return null;
    const device = await prisma_1.prisma.device.findFirst({
        where: {
            id: terminalDeviceId,
            companyId,
            clientType: 'ELECTRON',
            isPrintTerminal: true,
            printTerminalEnabled: true,
        },
        select: { id: true },
    });
    if (!device) {
        throw new Error('PRINT_TERMINAL_NOT_FOUND');
    }
    return device.id;
}
async function getSystemPrinters() {
    return await listGenericTextPrinters();
}
async function getPrintTerminals(companyId) {
    const devices = await prisma_1.prisma.device.findMany({
        where: {
            companyId,
            clientType: 'ELECTRON',
            isPrintTerminal: true,
        },
        include: {
            currentUser: { select: { id: true, username: true, name: true } },
        },
        orderBy: [{ lastSeenAt: 'desc' }, { name: 'asc' }],
    });
    return devices.map(normalizeTerminal);
}
async function listPrintPorts(companyId) {
    const ports = await prisma_1.prisma.printPort.findMany({
        where: { companyId },
        include: {
            terminalDevice: {
                include: {
                    currentUser: { select: { id: true, username: true, name: true } },
                },
            },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return ports.map(normalizePort);
}
async function createPrintPort(companyId, input) {
    const name = cleanText(input.name);
    if (!name)
        throw new Error('PRINT_PORT_NAME_REQUIRED');
    const port = await prisma_1.prisma.printPort.create({
        data: {
            companyId,
            name,
            description: cleanText(input.description),
            active: input.active ?? true,
            sortOrder: Number(input.sortOrder ?? 0),
            // Do not set terminal/printer fields here.
            // Physical binding is done later by the Electron Terminal.
            //
            // Also do not send paperWidth here. Some existing production DBs still
            // have paperWidth as NOT NULL with default 80, so omitting it lets the DB
            // default apply and avoids null constraint errors.
        },
        include: {
            terminalDevice: {
                include: {
                    currentUser: { select: { id: true, username: true, name: true } },
                },
            },
        },
    });
    return normalizePort(port);
}
async function updatePrintPort(companyId, portId, input) {
    const existing = await prisma_1.prisma.printPort.findFirst({ where: { id: portId, companyId } });
    if (!existing)
        throw new Error('PRINT_PORT_NOT_FOUND');
    const port = await prisma_1.prisma.printPort.update({
        where: { id: portId },
        data: {
            ...(input.name !== undefined ? { name: cleanText(input.name) ?? existing.name } : {}),
            ...(input.description !== undefined ? { description: cleanText(input.description) } : {}),
            ...(input.active !== undefined ? { active: Boolean(input.active) } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: Number(input.sortOrder ?? 0) } : {}),
            // Regular web editing should not touch physical terminal binding fields.
        },
        include: {
            terminalDevice: {
                include: {
                    currentUser: { select: { id: true, username: true, name: true } },
                },
            },
        },
    });
    return normalizePort(port);
}
async function deletePrintPort(companyId, portId) {
    const existing = await prisma_1.prisma.printPort.findFirst({ where: { id: portId, companyId } });
    if (!existing)
        throw new Error('PRINT_PORT_NOT_FOUND');
    await prisma_1.prisma.printPort.delete({ where: { id: portId } });
    return { ok: true };
}
async function bindPrintPort(companyId, portId, input) {
    const existing = await prisma_1.prisma.printPort.findFirst({ where: { id: portId, companyId } });
    if (!existing)
        throw new Error('PRINT_PORT_NOT_FOUND');
    const terminalDeviceId = await assertPortDevice(companyId, input.terminalDeviceId);
    const localPrinterName = cleanText(input.localPrinterName);
    const localPrinterLabel = cleanText(input.localPrinterLabel);
    const shouldClearBinding = !terminalDeviceId || !localPrinterName;
    const port = await prisma_1.prisma.printPort.update({
        where: { id: portId },
        data: shouldClearBinding
            ? {
                terminalDeviceId: null,
                localPrinterName: null,
                localPrinterLabel: null,
                // Do not set paperWidth to null; keep current/default value.
            }
            : {
                terminalDeviceId,
                localPrinterName,
                localPrinterLabel,
                ...(input.paperWidth !== undefined && input.paperWidth !== null
                    ? { paperWidth: Number(input.paperWidth) }
                    : {}),
            },
        include: {
            terminalDevice: {
                include: {
                    currentUser: { select: { id: true, username: true, name: true } },
                },
            },
        },
    });
    return normalizePort(port);
}
async function getPrinterSettings(companyId) {
    if (!companyId) {
        return {
            ports: [],
            terminals: [],
            printers: [],
            orderPrinterId: null,
            orderTicketTemplate: defaultTemplate,
        };
    }
    const [ports, terminals] = await Promise.all([
        listPrintPorts(companyId),
        getPrintTerminals(companyId),
    ]);
    return {
        ports,
        terminals,
        printers: [],
        orderPrinterId: null,
        orderTicketTemplate: defaultTemplate,
    };
}
async function savePrinterSettings(input) {
    return input;
}
const defaultTemplate = {
    showLogo: true,
    showOrderId: true,
    showDate: true,
    showComandaName: true,
    showVariations: true,
    showNotes: true,
    headerText: '*** ORDR ***',
    footerText: '',
};
async function testPrinter(printerNameFromRequest) {
    const printerName = printerNameFromRequest?.trim();
    if (!printerName)
        throw new Error('PRINTER_NOT_CONFIGURED');
    const content = [
        '*** ORDR ***',
        'TESTE DE IMPRESSAO',
        new Date().toLocaleString('pt-BR'),
        '',
        '',
        '',
    ].join('\n');
    await printRawThermalText(content, {
        printerName,
        feedLines: 6,
        cut: true,
    });
    return { ok: true };
}
// Legacy helpers kept for old local-print code paths. In hosted mode, order
// printing should use PrintJob queue + Electron terminal instead.
async function getSelectedOrderPrinter() {
    return null;
}
async function getOrderTicketTemplate() {
    return defaultTemplate;
}
async function getSelectedOrderPrinterName() {
    return null;
}
