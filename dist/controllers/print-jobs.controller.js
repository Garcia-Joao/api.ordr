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
exports.createPrintJob = createPrintJob;
exports.createOrderPrintJobs = createOrderPrintJobs;
exports.listTerminalPendingJobs = listTerminalPendingJobs;
exports.claimTerminalPrintPackage = claimTerminalPrintPackage;
exports.updateTerminalPrintPackageStatus = updateTerminalPrintPackageStatus;
exports.claimPrintJob = claimPrintJob;
exports.updatePrintJobStatus = updatePrintJobStatus;
exports.deletePrintJob = deletePrintJob;
const service = __importStar(require("../services/print-jobs.service"));
function param(value) {
    return Array.isArray(value) ? value[0] : value || '';
}
function handleError(res, error) {
    const message = error?.message || 'Erro de impressão.';
    if (['PRINT_PORT_NOT_FOUND', 'ORDER_NOT_FOUND', 'PRINT_JOB_NOT_FOUND'].includes(message)) {
        return res.status(404).json({ error: message });
    }
    if (['PRINT_PORT_NOT_BOUND', 'PRINT_TERMINAL_NOT_AVAILABLE', 'PRINT_TERMINAL_NOT_FOUND'].includes(message)) {
        return res.status(400).json({ error: message });
    }
    return res.status(500).json({ error: message });
}
async function createPrintJob(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        const job = await service.createPrintJob({ companyId, ...req.body });
        return res.status(201).json({ job });
    }
    catch (error) {
        console.error('create print job error:', error);
        return handleError(res, error);
    }
}
async function createOrderPrintJobs(req, res) {
    try {
        const companyId = req.user?.companyId;
        const orderId = param(req.params.orderId);
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        const jobs = await service.createOrderPrintJobs(companyId, orderId);
        return res.status(201).json({ jobs });
    }
    catch (error) {
        console.error('create order print jobs error:', error);
        return handleError(res, error);
    }
}
async function listTerminalPendingJobs(req, res) {
    try {
        const companyId = req.user?.companyId;
        const terminalDeviceId = String(req.query.terminalDeviceId ?? '');
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!terminalDeviceId)
            return res.status(400).json({ error: 'terminalDeviceId é obrigatório.' });
        const jobs = await service.listTerminalPendingJobs(companyId, terminalDeviceId);
        return res.json({ jobs });
    }
    catch (error) {
        console.error('list terminal pending jobs error:', error);
        return handleError(res, error);
    }
}
async function claimTerminalPrintPackage(req, res) {
    try {
        const companyId = req.user?.companyId;
        const terminalDeviceId = String(req.query.terminalDeviceId ?? req.body?.terminalDeviceId ?? '');
        const limit = Number(req.query.limit ?? req.body?.limit ?? 50);
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!terminalDeviceId)
            return res.status(400).json({ error: 'terminalDeviceId é obrigatório.' });
        const printPackage = await service.claimTerminalPrintPackage(companyId, terminalDeviceId, limit);
        return res.json({ package: printPackage });
    }
    catch (error) {
        console.error('claim terminal print package error:', error);
        return handleError(res, error);
    }
}
async function updateTerminalPrintPackageStatus(req, res) {
    try {
        const companyId = req.user?.companyId;
        const terminalDeviceId = String(req.body?.terminalDeviceId ?? '');
        const jobIds = Array.isArray(req.body?.jobIds) ? req.body.jobIds.map(String) : [];
        const status = String(req.body?.status ?? '');
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!terminalDeviceId || !status)
            return res.status(400).json({ error: 'terminalDeviceId e status são obrigatórios.' });
        const result = await service.updateTerminalPrintPackageStatus(companyId, terminalDeviceId, jobIds, status, req.body?.errorMessage ?? null);
        return res.json(result);
    }
    catch (error) {
        console.error('update terminal print package status error:', error);
        return handleError(res, error);
    }
}
async function claimPrintJob(req, res) {
    try {
        const companyId = req.user?.companyId;
        const terminalDeviceId = String(req.body?.terminalDeviceId ?? '');
        const jobId = param(req.params.id);
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!terminalDeviceId)
            return res.status(400).json({ error: 'terminalDeviceId é obrigatório.' });
        const job = await service.claimPrintJob(companyId, terminalDeviceId, jobId);
        return res.json({ job });
    }
    catch (error) {
        console.error('claim print job error:', error);
        return handleError(res, error);
    }
}
async function updatePrintJobStatus(req, res) {
    try {
        const companyId = req.user?.companyId;
        const terminalDeviceId = String(req.body?.terminalDeviceId ?? '');
        const status = String(req.body?.status ?? '');
        const jobId = param(req.params.id);
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!terminalDeviceId || !status)
            return res.status(400).json({ error: 'terminalDeviceId e status são obrigatórios.' });
        const job = await service.updatePrintJobStatus(companyId, terminalDeviceId, jobId, status, req.body?.errorMessage ?? null);
        return res.json({ job });
    }
    catch (error) {
        console.error('update print job status error:', error);
        return handleError(res, error);
    }
}
async function deletePrintJob(req, res) {
    try {
        const companyId = req.user?.companyId;
        const terminalDeviceId = String(req.body?.terminalDeviceId ?? req.query?.terminalDeviceId ?? '');
        const jobId = param(req.params.id);
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!terminalDeviceId)
            return res.status(400).json({ error: 'terminalDeviceId é obrigatório.' });
        const job = await service.deletePrintJob(companyId, terminalDeviceId, jobId);
        return res.json({ job });
    }
    catch (error) {
        console.error('delete print job error:', error);
        return handleError(res, error);
    }
}
