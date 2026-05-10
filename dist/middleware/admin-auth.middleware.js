"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePlatformAdmin = requirePlatformAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
async function requirePlatformAdmin(req, res, next) {
    try {
        const token = req.cookies?.admin_auth;
        if (!token) {
            return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED' });
        }
        const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ error: 'ADMIN_JWT_SECRET_NOT_CONFIGURED' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        if (!decoded.adminId) {
            return res.status(401).json({ error: 'ADMIN_INVALID_TOKEN' });
        }
        const admin = await prisma_1.prisma.platformAdminUser.findUnique({
            where: { id: decoded.adminId },
        });
        if (!admin || !admin.active) {
            return res.status(401).json({ error: 'ADMIN_NOT_FOUND_OR_INACTIVE' });
        }
        req.admin = {
            id: admin.id,
            username: admin.username,
            name: admin.name,
            role: admin.role,
        };
        return next();
    }
    catch (error) {
        console.error('[admin-auth] error:', error);
        return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED' });
    }
}
