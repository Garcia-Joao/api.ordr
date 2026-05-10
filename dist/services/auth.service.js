"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = loginUser;
exports.getUserFromToken = getUserFromToken;
exports.switchUserCompany = switchUserCompany;
exports.getCompaniesForUser = getCompaniesForUser;
exports.updateMyAccount = updateMyAccount;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const permissions_1 = require("../auth/permissions");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
function membershipPermissions(membership) {
    const systemRole = String(membership.systemRole ?? 'ADMIN');
    if (systemRole === 'ADMIN')
        return permissions_1.ALL_PERMISSION_KEYS;
    if (!membership.customRole?.active)
        return [];
    return membership.customRole.permissions.map((permission) => permission.permissionKey);
}
function toSafeUser(user, activeCompanyId) {
    const activeMembership = user.memberships.find((membership) => membership.company.id === activeCompanyId) ?? user.memberships[0];
    const activeSystemRole = String(activeMembership?.systemRole ?? 'ADMIN');
    const activePermissions = activeMembership
        ? membershipPermissions(activeMembership)
        : [];
    return {
        id: user.id,
        username: user.username,
        name: user.name ?? null,
        phone: user.phone ?? null,
        photoBase64: user.photoBase64 ?? null,
        role: String(activeMembership?.role ?? user.role),
        systemRole: activeSystemRole,
        customRoleId: activeMembership?.customRoleId ?? null,
        customRoleName: activeMembership?.customRole?.name ?? null,
        activeEventDateId: activeMembership?.activeEventDateId ?? null,
        permissions: activePermissions,
        companyId: activeCompanyId,
        companies: user.memberships.map((membership) => ({
            id: membership.company.id,
            name: membership.company.name,
            isTest: membership.company.isTest,
            role: String(membership.role),
            systemRole: String(membership.systemRole ?? 'ADMIN'),
            customRoleId: membership.customRoleId ?? null,
            customRoleName: membership.customRole?.name ?? null,
            activeEventDateId: membership.activeEventDateId ?? null,
            permissions: membershipPermissions(membership),
        })),
    };
}
async function loginUser(username, password) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { username },
        include: {
            memberships: {
                include: { company: true, customRole: { include: { permissions: true } } },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!user) {
        throw new Error('INVALID_CREDENTIALS');
    }
    const passwordMatches = await bcryptjs_1.default.compare(password, user.password);
    if (!passwordMatches) {
        throw new Error('INVALID_CREDENTIALS');
    }
    if (user.memberships.length === 0) {
        throw new Error('USER_WITHOUT_COMPANY');
    }
    const activeCompanyId = user.memberships[0].company.id;
    const safeUser = toSafeUser(user, activeCompanyId);
    const token = jsonwebtoken_1.default.sign({
        sub: user.id,
        username: user.username,
        role: String(user.role),
        companyId: activeCompanyId,
    }, JWT_SECRET, { expiresIn: '7d' });
    return {
        token,
        user: safeUser,
    };
}
async function getUserFromToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
            memberships: {
                include: { company: true, customRole: { include: { permissions: true } } },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!user) {
        throw new Error('USER_NOT_FOUND');
    }
    const hasAccessToCompany = user.memberships.some((membership) => membership.company.id === decoded.companyId);
    if (!hasAccessToCompany) {
        throw new Error('COMPANY_ACCESS_DENIED');
    }
    return toSafeUser(user, decoded.companyId);
}
async function switchUserCompany(userId, companyId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            memberships: {
                include: { company: true, customRole: { include: { permissions: true } } },
            },
        },
    });
    if (!user) {
        throw new Error('USER_NOT_FOUND');
    }
    const hasAccessToCompany = user.memberships.some((membership) => membership.company.id === companyId);
    if (!hasAccessToCompany) {
        throw new Error('COMPANY_ACCESS_DENIED');
    }
    const token = jsonwebtoken_1.default.sign({
        sub: user.id,
        username: user.username,
        role: String(user.role),
        companyId,
    }, JWT_SECRET, { expiresIn: '7d' });
    const safeUser = toSafeUser(user, companyId);
    return {
        token,
        user: safeUser,
    };
}
async function getCompaniesForUser(userId) {
    const memberships = await prisma_1.prisma.userCompany.findMany({
        where: { userId },
        include: { company: true, customRole: { include: { permissions: true } } },
        orderBy: { createdAt: 'asc' },
    });
    return memberships.map((membership) => ({
        id: membership.company.id,
        name: membership.company.name,
        isTest: membership.company.isTest,
        role: String(membership.role),
        systemRole: String(membership.systemRole ?? 'ADMIN'),
        customRoleId: membership.customRoleId ?? null,
        customRoleName: membership.customRole?.name ?? null,
        permissions: membershipPermissions(membership),
    }));
}
async function updateMyAccount(input) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: input.userId },
        include: {
            memberships: {
                include: { company: true, customRole: { include: { permissions: true } } },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!user) {
        throw new Error('USER_NOT_FOUND');
    }
    const isChangingUsername = typeof input.username !== 'undefined' &&
        input.username.trim() !== user.username;
    const isChangingPassword = typeof input.newPassword !== 'undefined';
    if (isChangingUsername || isChangingPassword) {
        if (!input.currentPassword) {
            throw new Error('CURRENT_PASSWORD_REQUIRED');
        }
        const currentPasswordMatches = await bcryptjs_1.default.compare(input.currentPassword, user.password);
        if (!currentPasswordMatches) {
            throw new Error('INVALID_CURRENT_PASSWORD');
        }
    }
    if (isChangingUsername) {
        const normalizedUsername = input.username.trim();
        if (!normalizedUsername) {
            throw new Error('USERNAME_REQUIRED');
        }
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { username: normalizedUsername },
        });
        if (existingUser && existingUser.id !== user.id) {
            throw new Error('USERNAME_ALREADY_EXISTS');
        }
    }
    if (typeof input.photoBase64 !== 'undefined' &&
        input.photoBase64 &&
        input.photoBase64.length > 1500000) {
        throw new Error('PHOTO_TOO_LARGE');
    }
    const data = {};
    if (typeof input.name !== 'undefined') {
        data.name = input.name.trim() || null;
    }
    if (typeof input.username !== 'undefined') {
        const normalizedUsername = input.username.trim();
        if (!normalizedUsername) {
            throw new Error('USERNAME_REQUIRED');
        }
        data.username = normalizedUsername;
    }
    if (typeof input.phone !== 'undefined') {
        data.phone = input.phone.trim() || null;
    }
    if (typeof input.photoBase64 !== 'undefined') {
        data.photoBase64 = input.photoBase64 || null;
    }
    if (typeof input.newPassword !== 'undefined') {
        const normalizedNewPassword = input.newPassword.trim();
        if (!normalizedNewPassword) {
            throw new Error('NEW_PASSWORD_REQUIRED');
        }
        if (normalizedNewPassword.length < 6) {
            throw new Error('PASSWORD_TOO_SHORT');
        }
        data.password = await bcryptjs_1.default.hash(normalizedNewPassword, 10);
    }
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id: input.userId },
        data,
        include: {
            memberships: {
                include: { company: true, customRole: { include: { permissions: true } } },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    const activeCompanyId = updatedUser.memberships[0]?.company.id;
    if (!activeCompanyId) {
        throw new Error('USER_WITHOUT_COMPANY');
    }
    return toSafeUser(updatedUser, activeCompanyId);
}
