"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCategoriesByCompany = getCategoriesByCompany;
exports.getCategoryById = getCategoryById;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
const prisma_1 = require("../lib/prisma");
const audit_service_1 = require("./audit.service");
function slugify(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}
function normalizeCategory(category) {
    return {
        id: category.id,
        name: category.name,
        emoji: category.emoji ?? '📦',
        slug: category.slug ?? null,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        printPortId: category.printPortId ?? null,
        printPort: category.printPort ?? null,
    };
}
async function getCategoriesByCompany(companyId) {
    const categories = await prisma_1.prisma.category.findMany({
        where: {
            companyId,
            deletedAt: null,
        },
        orderBy: { name: 'asc' },
        include: { printPort: true },
    });
    return categories.map(normalizeCategory);
}
async function getCategoryById(categoryId, companyId) {
    const category = await prisma_1.prisma.category.findFirst({
        where: {
            id: categoryId,
            companyId,
            deletedAt: null,
        },
        include: { printPort: true },
    });
    if (!category) {
        return null;
    }
    return normalizeCategory(category);
}
async function createCategory(data, userId) {
    if (!data.name?.trim()) {
        throw new Error('CATEGORY_NAME_REQUIRED');
    }
    const category = await prisma_1.prisma.$transaction(async (tx) => {
        const created = await tx.category.create({
            data: {
                companyId: data.companyId,
                name: data.name.trim(),
                slug: slugify(data.name),
                createdByUserId: userId,
                updatedByUserId: userId,
                ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
                ...(data.printPortId !== undefined ? { printPortId: data.printPortId || null } : {}),
            },
        });
        await (0, audit_service_1.createAuditLog)(tx, {
            companyId: data.companyId,
            userId,
            entityType: 'Category',
            entityId: created.id,
            action: 'CATEGORY_CREATED',
            newValues: {
                name: created.name,
                slug: created.slug,
                emoji: created.emoji,
            },
        });
        return created;
    });
    return normalizeCategory(category);
}
async function updateCategory(categoryId, companyId, data, userId) {
    const existingCategory = await prisma_1.prisma.category.findFirst({
        where: {
            id: categoryId,
            companyId,
            deletedAt: null,
        },
    });
    if (!existingCategory) {
        throw new Error('CATEGORY_NOT_FOUND');
    }
    if (data.name !== undefined && !data.name.trim()) {
        throw new Error('CATEGORY_NAME_REQUIRED');
    }
    const category = await prisma_1.prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({
            where: { id: categoryId },
            data: {
                name: data.name === undefined ? existingCategory.name : data.name.trim(),
                slug: data.name === undefined ? existingCategory.slug : slugify(data.name),
                updatedByUserId: userId,
                ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
                ...(data.printPortId !== undefined ? { printPortId: data.printPortId || null } : {}),
            },
        });
        await (0, audit_service_1.createAuditLog)(tx, {
            companyId,
            userId,
            entityType: 'Category',
            entityId: updated.id,
            action: 'CATEGORY_UPDATED',
            oldValues: {
                name: existingCategory.name,
                slug: existingCategory.slug,
                emoji: existingCategory.emoji,
            },
            newValues: {
                name: updated.name,
                slug: updated.slug,
                emoji: updated.emoji,
            },
        });
        return updated;
    });
    return normalizeCategory(category);
}
async function deleteCategory(categoryId, companyId, userId) {
    const existingCategory = await prisma_1.prisma.category.findFirst({
        where: {
            id: categoryId,
            companyId,
            deletedAt: null,
        },
    });
    if (!existingCategory) {
        throw new Error('CATEGORY_NOT_FOUND');
    }
    const linkedProducts = await prisma_1.prisma.product.count({
        where: {
            categoryId,
            companyId,
            active: true,
            deletedAt: null,
        },
    });
    if (linkedProducts > 0) {
        throw new Error('CATEGORY_HAS_PRODUCTS');
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.category.update({
            where: { id: categoryId },
            data: {
                deletedAt: new Date(),
                deletedByUserId: userId,
                updatedByUserId: userId,
            },
        });
        await (0, audit_service_1.createAuditLog)(tx, {
            companyId,
            userId,
            entityType: 'Category',
            entityId: categoryId,
            action: 'CATEGORY_DELETED',
            oldValues: {
                name: existingCategory.name,
                slug: existingCategory.slug,
                emoji: existingCategory.emoji,
            },
        });
    });
    return { ok: true };
}
