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
exports.heartbeat = heartbeat;
exports.listDevices = listDevices;
exports.deleteDevice = deleteDevice;
const devicesService = __importStar(require("../services/devices.service"));
function getIpAddress(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) {
        return forwarded[0] ?? null;
    }
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0]?.trim() || null;
    }
    return req.socket.remoteAddress ?? null;
}
function getStringValue(value) {
    if (typeof value === 'string') {
        return value.trim() || null;
    }
    if (Array.isArray(value)) {
        const firstValue = value[0];
        if (typeof firstValue === 'string') {
            return firstValue.trim() || null;
        }
    }
    return null;
}
async function heartbeat(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await devicesService.heartbeatDevice({
            companyId,
            userId,
            deviceId: getStringValue(req.body?.deviceId),
            name: getStringValue(req.body?.name),
            type: getStringValue(req.body?.type),
            browser: getStringValue(req.body?.browser),
            os: getStringValue(req.body?.os),
            userAgent: getStringValue(req.body?.userAgent) ??
                getStringValue(req.headers['user-agent']),
            ipAddress: getIpAddress(req),
            clientType: getStringValue(req.body?.clientType),
            isPrintTerminal: Boolean(req.body?.isPrintTerminal),
            printTerminalEnabled: Boolean(req.body?.printTerminalEnabled),
            localPrinters: Array.isArray(req.body?.localPrinters) ? req.body.localPrinters : [],
        });
        return res.json({ device: result });
    }
    catch (error) {
        console.error('device heartbeat error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to update device heartbeat',
        });
    }
}
async function listDevices(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const devices = await devicesService.listCompanyDevices(companyId);
        return res.json({ devices });
    }
    catch (error) {
        console.error('list devices error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to list devices',
        });
    }
}
async function deleteDevice(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const deviceId = getStringValue(req.params?.deviceId) ??
            getStringValue(req.query?.deviceId) ??
            getStringValue(req.body?.deviceId);
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId é obrigatório.' });
        }
        const result = await devicesService.deleteCompanyDevice({
            companyId,
            userId,
            deviceId,
        });
        return res.json(result);
    }
    catch (error) {
        console.error('delete device error:', error);
        if (error?.message === 'DEVICE_NOT_FOUND') {
            return res.status(404).json({ error: 'Dispositivo não encontrado.' });
        }
        if (error?.message === 'ADMIN_ACCESS_REQUIRED') {
            return res.status(403).json({
                error: 'Somente administradores podem remover dispositivos.',
            });
        }
        if (error?.message === 'COMPANY_ACCESS_DENIED') {
            return res.status(403).json({ error: 'Acesso negado à empresa.' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to delete device',
        });
    }
}
