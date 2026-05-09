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
exports.getSalesEnvironments = getSalesEnvironments;
exports.createSalesEnvironment = createSalesEnvironment;
exports.deleteSalesEnvironment = deleteSalesEnvironment;
const salesEnvironmentsService = __importStar(require("../services/sales-environments.service"));
async function getSalesEnvironments(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const environments = await salesEnvironmentsService.getSalesEnvironments(companyId);
        return res.json(environments);
    }
    catch (error) {
        console.error('getSalesEnvironments error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to fetch sales environments',
        });
    }
}
async function createSalesEnvironment(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { name, color } = req.body;
        const environment = await salesEnvironmentsService.createSalesEnvironment({
            companyId,
            name: name ?? '',
            color: color ?? '',
        });
        return res.status(201).json(environment);
    }
    catch (error) {
        console.error('createSalesEnvironment error:', error);
        switch (error?.message) {
            case 'COMPANY_ID_REQUIRED':
                return res.status(400).json({ error: 'Company ID is required' });
            case 'SALES_ENVIRONMENT_NAME_REQUIRED':
                return res.status(400).json({ error: 'Environment name is required' });
            case 'SALES_ENVIRONMENT_COLOR_REQUIRED':
                return res.status(400).json({ error: 'Environment color is required' });
            case 'SALES_ENVIRONMENT_NAME_ALREADY_EXISTS':
                return res.status(400).json({ error: 'An environment with this name already exists' });
            default:
                return res.status(500).json({
                    error: error?.message || 'Failed to create sales environment',
                });
        }
    }
}
async function deleteSalesEnvironment(req, res) {
    try {
        const companyId = req.user?.companyId;
        const environmentId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const environment = await salesEnvironmentsService.deleteSalesEnvironment({
            companyId,
            environmentId,
        });
        return res.json({ ok: true, environment });
    }
    catch (error) {
        console.error('deleteSalesEnvironment error:', error);
        switch (error?.message) {
            case 'SALES_ENVIRONMENT_NOT_FOUND':
                return res.status(404).json({ error: 'Sales environment not found' });
            case 'SALES_ENVIRONMENT_DEFAULT_CANNOT_BE_DELETED':
                return res.status(400).json({ error: 'Default environment cannot be deleted' });
            case 'SALES_ENVIRONMENT_HAS_CUSTOMERS':
                return res.status(400).json({
                    error: 'This environment has internal customers linked to it',
                });
            default:
                return res.status(500).json({
                    error: error?.message || 'Failed to delete sales environment',
                });
        }
    }
}
