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
exports.requireAuth = requireAuth;
const authService = __importStar(require("../services/auth.service"));
const COOKIE_NAME = 'auth';
function getBearerToken(req) {
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string') {
        return null;
    }
    if (!authorization.startsWith('Bearer ')) {
        return null;
    }
    return authorization.slice('Bearer '.length).trim() || null;
}
async function requireAuth(req, res, next) {
    try {
        const bearerToken = getBearerToken(req);
        const cookieToken = req.cookies?.[COOKIE_NAME];
        const token = bearerToken || cookieToken;
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await authService.getUserFromToken(token);
        req.user = user;
        const canPassInactiveLicense = req.baseUrl === '/auth' &&
            (req.path === '/me' || req.path === '/switch-company' || req.path === '/logout');
        if (!user.currentCompany?.licenseActive && !canPassInactiveLicense) {
            return res.status(403).json({
                error: 'COMPANY_LICENSE_INACTIVE',
                company: user.currentCompany ?? null,
            });
        }
        return next();
    }
    catch (error) {
        if (error?.message === 'ADMIN_ACCESS_REQUIRED') {
            return res.status(403).json({ error: 'ADMIN_ACCESS_REQUIRED' });
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }
}
