"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
const access_service_1 = require("../services/access.service");
function getHeaderString(value) {
    if (Array.isArray(value))
        return value[0];
    return value;
}
function requirePermission(...permissions) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            const companyId = getHeaderString(req.headers['x-company-id']) || req.user?.companyId;
            if (!userId || !companyId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const requiredPermissions = permissions.filter(Boolean);
            if (requiredPermissions.length === 0) {
                return next();
            }
            for (const permission of requiredPermissions) {
                const allowed = await (0, access_service_1.userHasPermission)({
                    userId,
                    companyId,
                    permission,
                });
                if (allowed) {
                    return next();
                }
            }
            return res.status(403).json({
                error: 'Você não tem permissão para realizar esta ação.',
                permissions: requiredPermissions,
            });
        }
        catch (error) {
            console.error('requirePermission error:', error);
            return res.status(500).json({ error: 'Erro ao validar permissão.' });
        }
    };
}
