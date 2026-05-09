"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemPrinters = getSystemPrinters;
exports.getPrinterSettings = getPrinterSettings;
exports.savePrinterSettings = savePrinterSettings;
exports.getSelectedOrderPrinter = getSelectedOrderPrinter;
exports.getOrderTicketTemplate = getOrderTicketTemplate;
exports.getSelectedOrderPrinterName = getSelectedOrderPrinterName;
exports.testPrinter = testPrinter;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const { listGenericTextPrinters, printRawThermalText, } = require('../../printer.js');
const DATA_DIR = path_1.default.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path_1.default.join(DATA_DIR, 'printer-settings.json');
const defaultSettings = {
    printers: [],
    orderPrinterId: null,
    orderTicketTemplate: {
        showLogo: true,
        showOrderId: true,
        showDate: true,
        showComandaName: true,
        showVariations: true,
        showNotes: true,
        headerText: '*** ORDR ***',
        footerText: '',
    },
};
async function ensureDataDir() {
    await promises_1.default.mkdir(DATA_DIR, { recursive: true });
}
async function readSettings() {
    try {
        const content = await promises_1.default.readFile(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        return {
            ...defaultSettings,
            ...parsed,
            orderTicketTemplate: {
                ...defaultSettings.orderTicketTemplate,
                ...(parsed.orderTicketTemplate ?? {}),
            },
            printers: Array.isArray(parsed.printers) ? parsed.printers : [],
        };
    }
    catch {
        return defaultSettings;
    }
}
async function writeSettings(settings) {
    await ensureDataDir();
    await promises_1.default.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}
async function getSystemPrinters() {
    return await listGenericTextPrinters();
}
async function getPrinterSettings() {
    return await readSettings();
}
async function savePrinterSettings(input) {
    const settings = {
        printers: Array.isArray(input.printers) ? input.printers : [],
        orderPrinterId: input.orderPrinterId ?? null,
        orderTicketTemplate: {
            ...defaultSettings.orderTicketTemplate,
            ...(input.orderTicketTemplate ?? {}),
        },
    };
    await writeSettings(settings);
    return settings;
}
async function getSelectedOrderPrinter() {
    const settings = await readSettings();
    if (!settings.orderPrinterId)
        return null;
    return (settings.printers.find((printer) => printer.id === settings.orderPrinterId) ??
        null);
}
async function getOrderTicketTemplate() {
    const settings = await readSettings();
    return settings.orderTicketTemplate;
}
async function getSelectedOrderPrinterName() {
    const printer = await getSelectedOrderPrinter();
    return printer?.systemName?.trim() || null;
}
async function testPrinter(printerNameFromRequest) {
    let printerName = printerNameFromRequest?.trim();
    if (!printerName) {
        printerName = await getSelectedOrderPrinterName();
    }
    if (!printerName) {
        throw new Error('PRINTER_NOT_CONFIGURED');
    }
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
