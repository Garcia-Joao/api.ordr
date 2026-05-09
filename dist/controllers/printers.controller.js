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
exports.getPrinterSettings = getPrinterSettings;
exports.savePrinterSettings = savePrinterSettings;
exports.testPrinter = testPrinter;
const printersService = __importStar(require("../services/printers.service"));
async function getSystemPrinters(_req, res) {
    try {
        const printers = await printersService.getSystemPrinters();
        return res.json(printers);
    }
    catch (error) {
        console.error('getSystemPrinters error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to fetch system printers',
        });
    }
}
async function getPrinterSettings(_req, res) {
    try {
        const settings = await printersService.getPrinterSettings();
        return res.json(settings);
    }
    catch (error) {
        console.error('getPrinterSettings error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to fetch printer settings',
        });
    }
}
async function savePrinterSettings(req, res) {
    try {
        const settings = await printersService.savePrinterSettings(req.body);
        return res.json(settings);
    }
    catch (error) {
        console.error('savePrinterSettings error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to save printer settings',
        });
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
        if (error?.message === 'PRINTER_NOT_CONFIGURED') {
            return res.status(400).json({ error: 'Printer not configured' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to test printer',
        });
    }
}
