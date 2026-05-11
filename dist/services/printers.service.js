"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemPrinters = getSystemPrinters;
exports.getPrintTerminals = getPrintTerminals;
exports.listPrintPorts = listPrintPorts;
exports.createPrintPort = createPrintPort;
exports.updatePrintPort = updatePrintPort;
exports.deletePrintPort = deletePrintPort;
exports.bindPrintPort = bindPrintPort;
exports.setPrintPortBindings = setPrintPortBindings;
exports.getPrintTemplate = getPrintTemplate;
exports.getPrintTemplates = getPrintTemplates;
exports.savePrintTemplate = savePrintTemplate;
exports.savePrintTemplates = savePrintTemplates;
exports.getPrinterSettings = getPrinterSettings;
exports.savePrinterSettings = savePrinterSettings;
exports.getOrderTicketTemplate = getOrderTicketTemplate;
exports.testPrinter = testPrinter;
exports.getSelectedOrderPrinter = getSelectedOrderPrinter;
exports.getSelectedOrderPrinterName = getSelectedOrderPrinterName;
const prisma_1 = require("../lib/prisma");
const ONLINE_THRESHOLD_MS = 45 * 1000;
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
function normalizeBinding(binding) {
    return {
        id: binding.id,
        portId: binding.portId,
        terminalDeviceId: binding.terminalDeviceId,
        localPrinterName: binding.localPrinterName,
        localPrinterLabel: binding.localPrinterLabel ?? binding.localPrinterName,
        createdAt: binding.createdAt?.toISOString?.() ?? binding.createdAt,
        updatedAt: binding.updatedAt?.toISOString?.() ?? binding.updatedAt,
        terminalDevice: binding.terminalDevice ? normalizeTerminal(binding.terminalDevice) : null,
    };
}
function normalizePort(port) {
    return {
        id: port.id,
        companyId: port.companyId,
        name: port.name,
        description: port.description ?? null,
        active: Boolean(port.active),
        sortOrder: Number(port.sortOrder ?? 0),
        // Legacy single-printer fields kept for backwards compatibility.
        terminalDeviceId: port.terminalDeviceId ?? null,
        localPrinterName: port.localPrinterName ?? null,
        localPrinterLabel: port.localPrinterLabel ?? null,
        paperWidth: port.paperWidth ?? null,
        bindings: (port.bindings ?? []).map(normalizeBinding),
        createdAt: port.createdAt?.toISOString?.() ?? port.createdAt,
        updatedAt: port.updatedAt?.toISOString?.() ?? port.updatedAt,
        terminalDevice: port.terminalDevice ? normalizeTerminal(port.terminalDevice) : null,
    };
}
const portInclude = {
    terminalDevice: {
        include: {
            currentUser: { select: { id: true, username: true, name: true } },
        },
    },
    bindings: {
        include: {
            terminalDevice: {
                include: {
                    currentUser: { select: { id: true, username: true, name: true } },
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    },
};
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
    if (!device)
        throw new Error('PRINT_TERMINAL_NOT_FOUND');
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
        include: portInclude,
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
        },
        include: portInclude,
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
        },
        include: portInclude,
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
// Legacy single-printer binding endpoint kept so older builds do not break.
async function bindPrintPort(companyId, portId, input) {
    const terminalDeviceId = await assertPortDevice(companyId, input.terminalDeviceId);
    const port = await prisma_1.prisma.printPort.findFirst({ where: { id: portId, companyId } });
    if (!port)
        throw new Error('PRINT_PORT_NOT_FOUND');
    await prisma_1.prisma.printPort.update({
        where: { id: portId },
        data: {
            terminalDeviceId,
            localPrinterName: cleanText(input.localPrinterName),
            localPrinterLabel: cleanText(input.localPrinterLabel),
            paperWidth: input.paperWidth ? Number(input.paperWidth) : null,
        },
    });
    if (terminalDeviceId && input.localPrinterName) {
        return setPrintPortBindings(companyId, portId, {
            terminalDeviceId,
            printers: [{
                    localPrinterName: input.localPrinterName,
                    localPrinterLabel: input.localPrinterLabel ?? input.localPrinterName,
                }],
        });
    }
    const updated = await prisma_1.prisma.printPort.findUnique({ where: { id: portId }, include: portInclude });
    return normalizePort(updated);
}
async function setPrintPortBindings(companyId, portId, input) {
    const terminalDeviceId = await assertPortDevice(companyId, input.terminalDeviceId);
    if (!terminalDeviceId)
        throw new Error('PRINT_TERMINAL_NOT_FOUND');
    const port = await prisma_1.prisma.printPort.findFirst({ where: { id: portId, companyId } });
    if (!port)
        throw new Error('PRINT_PORT_NOT_FOUND');
    const printers = (input.printers ?? [])
        .map((printer) => ({
        localPrinterName: cleanText(printer.localPrinterName),
        localPrinterLabel: cleanText(printer.localPrinterLabel) ?? cleanText(printer.localPrinterName),
    }))
        .filter((printer) => Boolean(printer.localPrinterName));
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.printPortBinding.deleteMany({ where: { portId, terminalDeviceId } }),
        ...(printers.length > 0
            ? [prisma_1.prisma.printPortBinding.createMany({
                    data: printers.map((printer) => ({
                        companyId,
                        portId,
                        terminalDeviceId,
                        localPrinterName: printer.localPrinterName,
                        localPrinterLabel: printer.localPrinterLabel,
                    })),
                    skipDuplicates: true,
                })]
            : []),
    ]);
    const updated = await prisma_1.prisma.printPort.findUnique({ where: { id: portId }, include: portInclude });
    return normalizePort(updated);
}
const defaultOrderTicketTemplate = {
    enabledFields: {
        logo: true,
        portName: true,
        orderId: true,
        comanda: true,
        comandaName: true,
        observation: true,
        items: true,
        variations: true,
        notes: true,
        date: true,
    },
    headerText: '*** ORDR ***',
    footerText: '',
};
const defaultBuyListTemplate = {
    enabledFields: {
        requestTitle: true,
        requestId: true,
        supplierName: true,
        eventName: true,
        notes: true,
        date: true,
        checklistBoxes: true,
        categories: true,
        itemNotes: true,
    },
    headerText: '*** LISTA DE COMPRAS ***',
    footerText: '',
};
const legacyOrderTemplate = {
    showLogo: true,
    showOrderId: true,
    showDate: true,
    showComandaName: true,
    showVariations: true,
    showNotes: true,
    headerText: '*** ORDR ***',
    footerText: '',
};
function getDefaultTemplate(kind) {
    return kind === 'BUY_LIST' ? defaultBuyListTemplate : defaultOrderTicketTemplate;
}
function sanitizeTemplateConfig(kind, input) {
    const defaults = getDefaultTemplate(kind);
    const enabledFields = { ...defaults.enabledFields };
    if (input?.enabledFields && typeof input.enabledFields === 'object') {
        for (const key of Object.keys(enabledFields)) {
            if (input.enabledFields[key] !== undefined) {
                enabledFields[key] = Boolean(input.enabledFields[key]);
            }
        }
    }
    return {
        enabledFields,
        headerText: cleanText(input?.headerText) ?? defaults.headerText,
        footerText: cleanText(input?.footerText) ?? '',
    };
}
function normalizeTemplateRecord(kind, record) {
    return {
        kind,
        config: sanitizeTemplateConfig(kind, record?.config),
        updatedAt: record?.updatedAt?.toISOString?.() ?? record?.updatedAt ?? null,
    };
}
async function getPrintTemplate(companyId, kind) {
    const record = await prisma_1.prisma.printTemplate.findUnique({
        where: { companyId_kind: { companyId, kind } },
    });
    return normalizeTemplateRecord(kind, record);
}
async function getPrintTemplates(companyId) {
    const templates = await prisma_1.prisma.printTemplate.findMany({ where: { companyId } });
    const byKind = new Map(templates.map((template) => [template.kind, template]));
    return {
        orderTicket: normalizeTemplateRecord('ORDER_TICKET', byKind.get('ORDER_TICKET')),
        buyList: normalizeTemplateRecord('BUY_LIST', byKind.get('BUY_LIST')),
    };
}
async function savePrintTemplate(companyId, kind, config) {
    const sanitized = sanitizeTemplateConfig(kind, config);
    const template = await prisma_1.prisma.printTemplate.upsert({
        where: { companyId_kind: { companyId, kind } },
        create: { companyId, kind, config: sanitized },
        update: { config: sanitized },
    });
    return normalizeTemplateRecord(kind, template);
}
async function savePrintTemplates(companyId, input) {
    const [orderTicket, buyList] = await Promise.all([
        input?.orderTicket ? savePrintTemplate(companyId, 'ORDER_TICKET', input.orderTicket.config ?? input.orderTicket) : getPrintTemplate(companyId, 'ORDER_TICKET'),
        input?.buyList ? savePrintTemplate(companyId, 'BUY_LIST', input.buyList.config ?? input.buyList) : getPrintTemplate(companyId, 'BUY_LIST'),
    ]);
    return { orderTicket, buyList };
}
async function getPrinterSettings(companyId) {
    if (!companyId) {
        return {
            ports: [],
            terminals: [],
            printers: [],
            orderPrinterId: null,
            orderTicketTemplate: legacyOrderTemplate,
            printTemplates: {
                orderTicket: normalizeTemplateRecord('ORDER_TICKET', null),
                buyList: normalizeTemplateRecord('BUY_LIST', null),
            },
        };
    }
    const [ports, terminals, printTemplates] = await Promise.all([
        listPrintPorts(companyId),
        getPrintTerminals(companyId),
        getPrintTemplates(companyId),
    ]);
    return {
        ports,
        terminals,
        printers: [],
        orderPrinterId: null,
        orderTicketTemplate: legacyOrderTemplate,
        printTemplates,
    };
}
async function savePrinterSettings(companyId, input) {
    if (!companyId)
        throw new Error('COMPANY_REQUIRED');
    const printTemplates = await savePrintTemplates(companyId, input?.printTemplates ?? input);
    return {
        ...(await getPrinterSettings(companyId)),
        printTemplates,
    };
}
async function getOrderTicketTemplate(companyId) {
    if (!companyId)
        return legacyOrderTemplate;
    const template = await getPrintTemplate(companyId, 'ORDER_TICKET');
    const config = template.config;
    return {
        showLogo: config.enabledFields.logo,
        showOrderId: config.enabledFields.orderId,
        showDate: config.enabledFields.date,
        showComandaName: config.enabledFields.comandaName,
        showVariations: config.enabledFields.variations,
        showNotes: config.enabledFields.notes,
        headerText: config.headerText,
        footerText: config.footerText,
    };
}
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
async function getSelectedOrderPrinter() {
    return null;
}
async function getSelectedOrderPrinterName() {
    return null;
}
