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
exports.listAuditLogs = listAuditLogs;
const auditService = __importStar(require("../services/audit.service"));
function getCompanyId(req) {
    return req.headers['x-company-id'] || req.user?.companyId;
}
async function listAuditLogs(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const result = await auditService.listAuditLogs({
            companyId,
            action: typeof req.query.action === 'string' ? req.query.action : undefined,
            entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
            userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
            search: typeof req.query.search === 'string' ? req.query.search : undefined,
            from: typeof req.query.from === 'string' ? req.query.from : undefined,
            to: typeof req.query.to === 'string' ? req.query.to : undefined,
            take: req.query.take ? Number(req.query.take) : undefined,
            cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
        });
        return res.json(result);
    }
    catch (error) {
        console.error('listAuditLogs error:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar auditoria' });
    }
}
