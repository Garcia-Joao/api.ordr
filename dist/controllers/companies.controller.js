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
const companiesService = __importStar(require("../services/companies.service"));
async function createTestCompany(req, res) {
    try {
        const userId = req.user?.id;
        const sourceCompanyId = req.user?.companyId;
        const { copyData } = req.body;
        if (!userId || !sourceCompanyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await companiesService.createTestCompanyFromCompany({
            userId,
            sourceCompanyId,
            copyData: Boolean(copyData),
        });
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('createTestCompany error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to create test company',
        });
    }
}
