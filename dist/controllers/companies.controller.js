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
exports.createTestCompany = createTestCompany;
exports.deleteTestCompany = deleteTestCompany;
const companiesService = __importStar(require("../services/companies.service"));
function statusForCompanyError(message) {
    if (message === 'COMPANY_ACCESS_DENIED')
        return 403;
    if (message === 'ADMIN_ACCESS_REQUIRED')
        return 403;
    if (message === 'SOURCE_COMPANY_NOT_FOUND')
        return 404;
    if (message === 'COMPANY_NOT_FOUND')
        return 404;
    if (message === 'SOURCE_COMPANY_IS_ALREADY_TEST')
        return 400;
    if (message === 'ONLY_TEST_COMPANY_CAN_BE_DELETED')
        return 400;
    return 500;
}
async function createTestCompany(req, res) {
    try {
        const userId = req.user?.id;
        const currentCompanyId = req.user?.companyId;
        const { copyData, sourceCompanyId } = req.body;
        const resolvedSourceCompanyId = sourceCompanyId || currentCompanyId;
        if (!userId || !resolvedSourceCompanyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await companiesService.createTestCompanyFromCompany({
            userId,
            sourceCompanyId: resolvedSourceCompanyId,
            copyData: Boolean(copyData),
        });
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('createTestCompany error:', error);
        return res.status(statusForCompanyError(error?.message)).json({
            error: error?.message || 'Failed to create test company',
        });
    }
}
async function deleteTestCompany(req, res) {
    try {
        const userId = req.user?.id;
        const { companyId } = req.params;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' });
        }
        const result = await companiesService.deleteTestCompany({
            userId,
            companyId,
        });
        return res.json(result);
    }
    catch (error) {
        console.error('deleteTestCompany error:', error);
        return res.status(statusForCompanyError(error?.message)).json({
            error: error?.message || 'Failed to delete test company',
        });
    }
}
