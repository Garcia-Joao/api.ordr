"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureBaseData = ensureBaseData;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
async function ensureBaseData() {
    const defaultCompanyName = process.env.DEFAULT_COMPANY_NAME || 'Minha Empresa';
    const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || '123456';
    let company = await prisma_1.prisma.company.findFirst({
        where: { name: defaultCompanyName },
    });
    if (!company) {
        company = await prisma_1.prisma.company.create({
            data: {
                name: defaultCompanyName,
                isTest: true,
            },
        });
        console.log(`[bootstrap] Company created: ${company.name}`);
    }
    else {
        console.log(`[bootstrap] Company already exists: ${company.name}`);
    }
    let user = await prisma_1.prisma.user.findUnique({
        where: { username: defaultUsername },
    });
    if (!user) {
        const hashedPassword = await bcryptjs_1.default.hash(defaultPassword, 10);
        user = await prisma_1.prisma.user.create({
            data: {
                username: defaultUsername,
                password: hashedPassword,
                role: 'admin',
            },
        });
        console.log(`[bootstrap] User created: ${user.username}`);
    }
    else {
        console.log(`[bootstrap] User already exists: ${user.username}`);
    }
    const membership = await prisma_1.prisma.userCompany.findFirst({
        where: {
            userId: user.id,
            companyId: company.id,
        },
    });
    if (!membership) {
        await prisma_1.prisma.userCompany.create({
            data: {
                userId: user.id,
                companyId: company.id,
                role: 'admin',
            },
        });
        console.log('[bootstrap] User-company membership created');
    }
    else {
        console.log('[bootstrap] User-company membership already exists');
    }
}
