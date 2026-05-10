"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_COOKIE_NAME = void 0;
exports.ensureInitialPlatformAdmin = ensureInitialPlatformAdmin;
exports.createAdminUser = createAdminUser;
exports.loginAdmin = loginAdmin;
exports.listLicensePlans = listLicensePlans;
exports.createLicensePlan = createLicensePlan;
exports.updateLicensePlan = updateLicensePlan;
exports.listCompanies = listCompanies;
exports.getCompany = getCompany;
exports.createCompanyWithInitialAccess = createCompanyWithInitialAccess;
exports.updateCompanyAccess = updateCompanyAccess;
exports.assignCompanyLicense = assignCompanyLicense;
exports.getAdminMe = getAdminMe;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const ADMIN_COOKIE_NAME = 'admin_auth';
exports.ADMIN_COOKIE_NAME = ADMIN_COOKIE_NAME;
function getAdminJwtSecret() {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('ADMIN_JWT_SECRET_NOT_CONFIGURED');
    }
    return secret;
}
function normalizeSlug(value) {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}
function buildLicenseDates(plan) {
    const startsAt = new Date();
    if (plan.isLifetime) {
        return {
            startsAt,
            endsAt: null,
        };
    }
    if (!plan.durationMonths || plan.durationMonths <= 0) {
        throw new Error('LICENSE_PLAN_DURATION_INVALID');
    }
    return {
        startsAt,
        endsAt: addMonths(startsAt, plan.durationMonths),
    };
}
async function ensureInitialPlatformAdmin() {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Administrador';
    if (!username || !password) {
        console.log('[admin] ADMIN_USERNAME/ADMIN_PASSWORD not configured. Skipping admin bootstrap.');
        return null;
    }
    const existing = await prisma_1.prisma.platformAdminUser.findUnique({
        where: { username },
    });
    if (existing) {
        console.log('[admin] Platform admin already exists:', username);
        return existing;
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    const admin = await prisma_1.prisma.platformAdminUser.create({
        data: {
            username,
            password: hashedPassword,
            name,
            role: 'OWNER',
            active: true,
        },
    });
    console.log('[admin] Platform admin created:', username);
    return admin;
}
async function createAdminUser(input) {
    const username = input.username.trim();
    if (!username) {
        throw new Error('ADMIN_USERNAME_REQUIRED');
    }
    if (!input.password || input.password.length < 6) {
        throw new Error('ADMIN_PASSWORD_MIN_LENGTH');
    }
    const password = await bcryptjs_1.default.hash(input.password, 10);
    const admin = await prisma_1.prisma.platformAdminUser.create({
        data: {
            username,
            password,
            name: input.name ?? null,
            role: 'OWNER',
            active: true,
        },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            active: true,
            createdAt: true,
        },
    });
    return {
        ok: true,
        admin,
    };
}
async function loginAdmin(input) {
    const username = input.username.trim();
    const admin = await prisma_1.prisma.platformAdminUser.findUnique({
        where: { username },
    });
    if (!admin || !admin.active) {
        throw new Error('ADMIN_INVALID_CREDENTIALS');
    }
    const validPassword = await bcryptjs_1.default.compare(input.password, admin.password);
    if (!validPassword) {
        throw new Error('ADMIN_INVALID_CREDENTIALS');
    }
    const token = jsonwebtoken_1.default.sign({
        adminId: admin.id,
    }, getAdminJwtSecret(), {
        expiresIn: '7d',
    });
    return {
        ok: true,
        token,
        admin: {
            id: admin.id,
            username: admin.username,
            name: admin.name,
            role: admin.role,
        },
    };
}
async function listLicensePlans() {
    const plans = await prisma_1.prisma.licensePlan.findMany({
        orderBy: [
            { active: 'desc' },
            { createdAt: 'desc' },
        ],
    });
    return {
        ok: true,
        plans,
    };
}
async function createLicensePlan(input) {
    const name = input.name.trim();
    if (!name) {
        throw new Error('LICENSE_PLAN_NAME_REQUIRED');
    }
    const slug = normalizeSlug(input.slug || name);
    if (!slug) {
        throw new Error('LICENSE_PLAN_SLUG_REQUIRED');
    }
    const isLifetime = Boolean(input.isLifetime);
    if (!isLifetime && (!input.durationMonths || input.durationMonths <= 0)) {
        throw new Error('LICENSE_PLAN_DURATION_REQUIRED');
    }
    const plan = await prisma_1.prisma.licensePlan.create({
        data: {
            name,
            slug,
            description: input.description ?? null,
            durationMonths: isLifetime ? null : input.durationMonths,
            isLifetime,
            active: input.active ?? true,
            createdByAdminId: input.adminId,
        },
    });
    return {
        ok: true,
        plan,
    };
}
async function updateLicensePlan(id, input) {
    const data = {};
    if (input.name !== undefined) {
        data.name = input.name.trim();
    }
    if (input.slug !== undefined) {
        data.slug = normalizeSlug(input.slug);
    }
    if (input.description !== undefined) {
        data.description = input.description ?? null;
    }
    if (input.isLifetime !== undefined) {
        data.isLifetime = input.isLifetime;
        if (input.isLifetime) {
            data.durationMonths = null;
        }
    }
    if (input.durationMonths !== undefined) {
        data.durationMonths = input.durationMonths;
    }
    if (input.active !== undefined) {
        data.active = input.active;
    }
    const plan = await prisma_1.prisma.licensePlan.update({
        where: { id },
        data,
    });
    return {
        ok: true,
        plan,
    };
}
async function listCompanies() {
    const companies = await prisma_1.prisma.company.findMany({
        include: {
            memberships: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            phone: true,
                            createdAt: true,
                            role: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'asc',
                },
            },
            platformLicenses: {
                include: {
                    plan: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: 1,
            },
            _count: {
                select: {
                    orders: true,
                    products: true,
                    customers: true,
                    memberships: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    return {
        ok: true,
        companies,
    };
}
async function getCompany(companyId) {
    const company = await prisma_1.prisma.company.findUnique({
        where: { id: companyId },
        include: {
            memberships: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            phone: true,
                            createdAt: true,
                            role: true,
                        },
                    },
                    customRole: true,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            },
            platformLicenses: {
                include: {
                    plan: true,
                    createdByAdmin: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            },
            _count: {
                select: {
                    orders: true,
                    products: true,
                    customers: true,
                    memberships: true,
                    eventDates: true,
                },
            },
        },
    });
    if (!company) {
        throw new Error('COMPANY_NOT_FOUND');
    }
    return {
        ok: true,
        company,
    };
}
async function createCompanyWithInitialAccess(input) {
    const companyName = input.name.trim();
    const ownerUsername = input.ownerUsername.trim();
    if (!companyName) {
        throw new Error('COMPANY_NAME_REQUIRED');
    }
    if (!ownerUsername) {
        throw new Error('OWNER_USERNAME_REQUIRED');
    }
    if (!input.ownerPassword || input.ownerPassword.length < 6) {
        throw new Error('OWNER_PASSWORD_MIN_LENGTH');
    }
    const existingUser = await prisma_1.prisma.user.findUnique({
        where: { username: ownerUsername },
    });
    if (existingUser) {
        throw new Error('OWNER_USERNAME_ALREADY_EXISTS');
    }
    const plan = input.licensePlanId
        ? await prisma_1.prisma.licensePlan.findUnique({
            where: { id: input.licensePlanId },
        })
        : null;
    if (input.licensePlanId && !plan) {
        throw new Error('LICENSE_PLAN_NOT_FOUND');
    }
    if (plan && !plan.active) {
        throw new Error('LICENSE_PLAN_INACTIVE');
    }
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
            data: {
                name: companyName,
                isTest: input.isTest ?? false,
                platformAccessStatus: 'ACTIVE',
            },
        });
        const password = await bcryptjs_1.default.hash(input.ownerPassword, 10);
        const user = await tx.user.create({
            data: {
                username: ownerUsername,
                password,
                name: input.ownerName ?? null,
                phone: input.ownerPhone ?? null,
                role: 'admin',
            },
        });
        const membership = await tx.userCompany.create({
            data: {
                userId: user.id,
                companyId: company.id,
                role: 'admin',
                systemRole: 'ADMIN',
            },
        });
        const defaultEnvironment = await tx.salesEnvironment.create({
            data: {
                companyId: company.id,
                name: 'Default',
                color: '#dd7c12',
                isDefault: true,
                active: true,
            },
        });
        let license = null;
        if (plan) {
            await tx.companyLicense.updateMany({
                where: {
                    companyId: company.id,
                    status: 'ACTIVE',
                },
                data: {
                    status: 'REPLACED',
                },
            });
            const { startsAt, endsAt } = buildLicenseDates(plan);
            license = await tx.companyLicense.create({
                data: {
                    companyId: company.id,
                    planId: plan.id,
                    status: 'ACTIVE',
                    startsAt,
                    endsAt,
                    notes: input.licenseNotes ?? null,
                    createdByAdminId: input.adminId,
                },
                include: {
                    plan: true,
                },
            });
        }
        return {
            company,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                phone: user.phone,
                role: user.role,
            },
            membership,
            defaultEnvironment,
            license,
        };
    });
    return {
        ok: true,
        ...result,
    };
}
async function updateCompanyAccess(companyId, input) {
    const blocked = input.platformAccessStatus === 'BLOCKED' ||
        input.platformAccessStatus === 'SUSPENDED' ||
        input.platformAccessStatus === 'CANCELLED';
    const company = await prisma_1.prisma.company.update({
        where: { id: companyId },
        data: {
            platformAccessStatus: input.platformAccessStatus,
            platformBlockedAt: blocked ? new Date() : null,
            platformBlockedReason: blocked ? input.platformBlockedReason ?? null : null,
        },
    });
    return {
        ok: true,
        company,
    };
}
async function assignCompanyLicense(input) {
    const company = await prisma_1.prisma.company.findUnique({
        where: { id: input.companyId },
    });
    if (!company) {
        throw new Error('COMPANY_NOT_FOUND');
    }
    const plan = await prisma_1.prisma.licensePlan.findUnique({
        where: { id: input.planId },
    });
    if (!plan) {
        throw new Error('LICENSE_PLAN_NOT_FOUND');
    }
    if (!plan.active) {
        throw new Error('LICENSE_PLAN_INACTIVE');
    }
    const { startsAt, endsAt } = buildLicenseDates(plan);
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.companyLicense.updateMany({
            where: {
                companyId: input.companyId,
                status: 'ACTIVE',
            },
            data: {
                status: 'REPLACED',
            },
        });
        const license = await tx.companyLicense.create({
            data: {
                companyId: input.companyId,
                planId: input.planId,
                status: 'ACTIVE',
                startsAt,
                endsAt,
                notes: input.notes ?? null,
                createdByAdminId: input.adminId,
            },
            include: {
                plan: true,
                company: true,
            },
        });
        await tx.company.update({
            where: {
                id: input.companyId,
            },
            data: {
                platformAccessStatus: 'ACTIVE',
                platformBlockedAt: null,
                platformBlockedReason: null,
            },
        });
        return license;
    });
    return {
        ok: true,
        license: result,
    };
}
async function getAdminMe(adminId) {
    const admin = await prisma_1.prisma.platformAdminUser.findUnique({
        where: { id: adminId },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            active: true,
            createdAt: true,
        },
    });
    if (!admin || !admin.active) {
        throw new Error('ADMIN_NOT_FOUND');
    }
    return {
        ok: true,
        admin,
    };
}
