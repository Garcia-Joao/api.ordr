"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemPrinters = getSystemPrinters;
exports.getPrintTerminals = getPrintTerminals;
exports.listPrintPorts = listPrintPorts;
exports.createPrintPort = createPrintPort;
exports.updatePrintPort = updatePrintPort;
exports.bindPrintPort = bindPrintPort;
exports.deletePrintPort = deletePrintPort;
exports.getPrinterSettings = getPrinterSettings;
exports.savePrinterSettings = savePrinterSettings;
exports.testPrinter = testPrinter;
const printersService = __importStar(require("../services/printers.service"));
function getParam(value) {
    if (!value)
        return '';
    return Array.isArray(value) ? value[0] : value;
}
async function getSystemPrinters(_req, res) {
    try {
        const printers = await printersService.getSystemPrinters();
        return res.json(printers);
    }
    catch (error) {
        console.error('getSystemPrinters error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to fetch system printers' });
    }
}
async function getPrintTerminals(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        const terminals = await printersService.getPrintTerminals(companyId);
        return res.json({ terminals });
    }
    catch (error) {
        console.error('getPrintTerminals error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to fetch terminals' });
    }
}
async function listPrintPorts(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        const ports = await printersService.listPrintPorts(companyId);
        return res.json({ ports });
    }
    catch (error) {
        console.error('listPrintPorts error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to fetch print ports' });
    }
}
async function createPrintPort(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        const port = await printersService.createPrintPort(companyId, req.body);
        return res.status(201).json({ port });
    }
    catch (error) {
        console.error('createPrintPort error:', error);
        if (error?.message === 'PRINT_PORT_NAME_REQUIRED')
            return res.status(400).json({ error: 'Nome da port é obrigatório.' });
        if (error?.message === 'PRINT_TERMINAL_NOT_FOUND')
            return res.status(400).json({ error: 'Terminal de impressão inválido ou offline.' });
        return res.status(500).json({ error: error?.message || 'Failed to create print port' });
    }
}
async function updatePrintPort(req, res) {
    try {
        const companyId = req.user?.companyId;
        const portId = getParam(req.params.id);
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        const port = await printersService.updatePrintPort(companyId, portId, req.body);
        return res.json({ port });
    }
    catch (error) {
        console.error('updatePrintPort error:', error);
        if (error?.message === 'PRINT_PORT_NOT_FOUND')
            return res.status(404).json({ error: 'Port não encontrada.' });
        if (error?.message === 'PRINT_TERMINAL_NOT_FOUND')
            return res.status(400).json({ error: 'Terminal de impressão inválido ou offline.' });
        return res.status(500).json({ error: error?.message || 'Failed to update print port' });
    }
}
async function bindPrintPort(req, res) {
    try {
        const companyId = req.user?.companyId;
        const portId = getParam(req.params.id);
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        const port = await printersService.bindPrintPort(companyId, portId, req.body);
        return res.json({ port });
    }
    catch (error) {
        console.error('bindPrintPort error:', error);
        if (error?.message === 'PRINT_PORT_NOT_FOUND')
            return res.status(404).json({ error: 'Port não encontrada.' });
        if (error?.message === 'PRINT_TERMINAL_NOT_FOUND')
            return res.status(400).json({ error: 'Terminal de impressão inválido ou offline.' });
        return res.status(500).json({ error: error?.message || 'Failed to bind print port' });
    }
}
async function deletePrintPort(req, res) {
    try {
        const companyId = req.user?.companyId;
        const portId = getParam(req.params.id);
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        const result = await printersService.deletePrintPort(companyId, portId);
        return res.json(result);
    }
    catch (error) {
        console.error('deletePrintPort error:', error);
        if (error?.message === 'PRINT_PORT_NOT_FOUND')
            return res.status(404).json({ error: 'Port não encontrada.' });
        return res.status(500).json({ error: error?.message || 'Failed to delete print port' });
    }
}
async function getPrinterSettings(req, res) {
    try {
        const settings = await printersService.getPrinterSettings(req.user?.companyId);
        return res.json(settings);
    }
    catch (error) {
        console.error('getPrinterSettings error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to fetch printer settings' });
    }
}
async function savePrinterSettings(req, res) {
    try {
        const settings = await printersService.savePrinterSettings(req.body);
        return res.json(settings);
    }
    catch (error) {
        console.error('savePrinterSettings error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to save printer settings' });
    }
}
async function testPrinter(req, res) {
    try {
        const { printerName } = req.body;
        const result = await printersService.testPrinter(printerName);
        return res.json(result);
    }
    catch (error) {
        console.error('testPrinter error:', error);
        if (error?.message === 'PRINTER_NOT_CONFIGURED')
            return res.status(400).json({ error: 'Printer not configured' });
        return res.status(500).json({ error: error?.message || 'Failed to test printer' });
    }
}
