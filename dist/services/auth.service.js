"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTerminalLaunchToken = createTerminalLaunchToken;
exports.loginTerminalWithLaunchToken = loginTerminalWithLaunchToken;
exports.loginUser = loginUser;
exports.getUserFromToken = getUserFromToken;
exports.switchUserCompany = switchUserCompany;
exports.getCompaniesForUser = getCompaniesForUser;
exports.updateMyAccount = updateMyAccount;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const permissions_1 = require("../auth/permissions");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
function getDaysRemaining(endsAt) {
    if (!endsAt)
        return null;
    const end = new Date(endsAt).getTime();
    if (Number.isNaN(end))
        return null;
    const diff = end - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
function resolveCompanyLicenseInfo(company) {
    const sourceCompany = company?.isTest && company?.testSourceCompany
        ? company.testSourceCompany
        : company;
    const now = new Date();
    const licenses = Array.isArray(sourceCompany?.platformLicenses)
        ? sourceCompany.platformLicenses
        : [];
    const activeLicense = licenses.find((license) => {
        const startsAt = license.startsAt ? new Date(license.startsAt) : null;
        const endsAt = license.endsAt ? new Date(license.endsAt) : null;
        return (String(license.status) === 'ACTIVE' &&
            (!startsAt || startsAt <= now) &&
            (!endsAt || endsAt > now));
    });
    const displayLicense = activeLicense ?? licenses[0] ?? null;
    const platformAccessStatus = String(sourceCompany?.platformAccessStatus ?? 'ACTIVE');
    const licenseActive = platformAccessStatus === 'ACTIVE' && Boolean(activeLicense);
    return {
        licenseActive,
        licenseStatus: licenseActive
            ? 'ACTIVE'
            : platformAccessStatus !== 'ACTIVE'
                ? platformAccessStatus
                : displayLicense?.status
                    ? String(displayLicense.status)
                    : 'INACTIVE',
        licensePlanName: displayLicense?.plan?.name ?? null,
        licenseStartsAt: displayLicense?.startsAt
            ? new Date(displayLicense.startsAt).toISOString()
            : null,
        licenseEndsAt: displayLicense?.endsAt
            ? new Date(displayLicense.endsAt).toISOString()
            : null,
        licenseDaysRemaining: getDaysRemaining(displayLicense?.endsAt ?? null),
        platformAccessStatus,
        platformBlockedReason: sourceCompany?.platformBlockedReason ?? null,
        licenseSourceCompanyId: sourceCompany?.id ?? null,
        licenseSourceCompanyName: sourceCompany?.name ?? null,
    };
}
function membershipToSafeCompany(membership) {
    const systemRole = String(membership.systemRole ?? 'ADMIN');
    return {
        id: membership.company.id,
        name: membership.company.name,
        companyType: String(membership.company.companyType ?? 'BUSINESS'),
        isTest: membership.company.isTest,
        testSourceCompanyId: membership.company.testSourceCompanyId ?? null,
        role: String(membership.role),
        systemRole,
        customRoleId: membership.customRoleId ?? null,
        customRoleName: membership.customRole?.name ?? null,
        activeEventDateId: membership.activeEventDateId ?? null,
        permissions: membershipPermissions(membership),
        ...resolveCompanyLicenseInfo(membership.company),
    };
}
function canAccessMembershipCompany(membership) {
    return resolveCompanyLicenseInfo(membership.company).licenseActive;
}
function membershipPermissions(membership) {
    const systemRole = String(membership.systemRole ?? 'ADMIN');
    if (systemRole === 'ADMIN')
        return permissions_1.ALL_PERMISSION_KEYS;
    if (!membership.customRole?.active)
        return [];
    return membership.customRole.permissions.map((permission) => permission.permissionKey);
}
function toSafeUser(user, activeCompanyId) {
    const sortedMemberships = [...user.memberships].sort((a, b) => {
        if (a.company.isTest !== b.company.isTest)
            return a.company.isTest ? 1 : -1;
        return a.company.name.localeCompare(b.company.name);
    });
    const safeCompanies = sortedMemberships.map(membershipToSafeCompany);
    const activeMembership = user.memberships.find((membership) => membership.company.id === activeCompanyId) ?? user.memberships[0];
    const activeSystemRole = String(activeMembership?.systemRole ?? 'ADMIN');
    const activePermissions = activeMembership
        ? membershipPermissions(activeMembership)
        : [];
    const currentCompany = safeCompanies.find((company) => company.id === activeCompanyId) ??
        safeCompanies[0] ??
        null;
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
        companyId: currentCompany?.id ?? activeCompanyId,
        currentCompany,
        companies: safeCompanies,
    };
}
const userMembershipInclude = {
    company: {
        include: {
            platformLicenses: {
                include: { plan: true },
                orderBy: { startsAt: 'desc' },
            },
            testSourceCompany: {
                include: {
                    platformLicenses: {
                        include: { plan: true },
                        orderBy: { startsAt: 'desc' },
                    },
                },
            },
        },
    },
    customRole: { include: { permissions: true } },
};
function createTerminalLaunchToken(input) {
    return jsonwebtoken_1.default.sign({
        sub: input.userId,
        companyId: input.companyId,
        purpose: 'terminal-launch',
    }, JWT_SECRET, { expiresIn: '2m' });
}
async function loginTerminalWithLaunchToken(launchToken) {
    try {
        const decoded = jsonwebtoken_1.default.verify(launchToken, JWT_SECRET);
        if (decoded.purpose !== 'terminal-launch') {
            throw new Error('INVALID_TERMINAL_TOKEN');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.sub },
            include: {
                memberships: {
                    where: {
                        companyId: decoded.companyId,
                    },
                    include: {
                        company: true,
                    },
                },
            },
        });
        if (!user)
            throw new Error('INVALID_TERMINAL_TOKEN');
        const membership = user.memberships[0];
        if (!membership)
            throw new Error('INVALID_TERMINAL_TOKEN');
        const token = jsonwebtoken_1.default.sign({
            sub: user.id,
            username: user.username,
            role: String(user.role),
            companyId: decoded.companyId,
        }, JWT_SECRET, { expiresIn: '30d' });
        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                companyId: decoded.companyId,
                currentCompany: {
                    id: membership.company.id,
                    name: membership.company.name,
                    isTest: membership.company.isTest,
                    systemRole: membership.systemRole,
                },
                companies: user.memberships.map((item) => ({
                    id: item.company.id,
                    name: item.company.name,
                    isTest: item.company.isTest,
                    systemRole: item.systemRole,
                })),
            },
        };
    }
    catch {
        throw new Error('INVALID_TERMINAL_TOKEN');
    }
}
async function loginUser(username, password) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { username },
        include: {
            memberships: {
                include: userMembershipInclude,
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
    const activeCompanyId = user.memberships.find((membership) => !membership.company.isTest && canAccessMembershipCompany(membership))?.company.id ??
        user.memberships.find((membership) => canAccessMembershipCompany(membership))?.company.id ??
        user.memberships.find((membership) => !membership.company.isTest)?.company.id ??
        user.memberships[0].company.id;
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
                include: userMembershipInclude,
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!user) {
        throw new Error('USER_NOT_FOUND');
    }
    const activeMembership = user.memberships.find((membership) => membership.company.id === decoded.companyId);
    if (!activeMembership) {
        throw new Error('COMPANY_ACCESS_DENIED');
    }
    if (activeMembership.company.isTest && activeMembership.systemRole !== 'ADMIN') {
        throw new Error('ADMIN_ACCESS_REQUIRED');
    }
    return toSafeUser(user, decoded.companyId);
}
async function switchUserCompany(userId, companyId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            memberships: {
                include: userMembershipInclude,
            },
        },
    });
    if (!user) {
        throw new Error('USER_NOT_FOUND');
    }
    const targetMembership = user.memberships.find((membership) => membership.company.id === companyId);
    if (!targetMembership) {
        throw new Error('COMPANY_ACCESS_DENIED');
    }
    if (targetMembership.company.isTest && targetMembership.systemRole !== 'ADMIN') {
        throw new Error('ADMIN_ACCESS_REQUIRED');
    }
    if (!canAccessMembershipCompany(targetMembership)) {
        throw new Error('COMPANY_LICENSE_INACTIVE');
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
        include: userMembershipInclude,
        orderBy: { createdAt: 'asc' },
    });
    return memberships
        .sort((a, b) => {
        if (a.company.isTest !== b.company.isTest)
            return a.company.isTest ? 1 : -1;
        return a.company.name.localeCompare(b.company.name);
    })
        .map((membership) => membershipToSafeCompany(membership));
}
async function updateMyAccount(input) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: input.userId },
        include: {
            memberships: {
                include: userMembershipInclude,
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
                include: userMembershipInclude,
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
