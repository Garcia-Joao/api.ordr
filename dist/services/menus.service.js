"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMenus = listMenus;
exports.getActiveMenu = getActiveMenu;
exports.getMenu = getMenu;
exports.createMenu = createMenu;
exports.duplicateMenu = duplicateMenu;
exports.deactivateMenu = deactivateMenu;
exports.updateMenu = updateMenu;
exports.activateMenu = activateMenu;
exports.deleteMenu = deleteMenu;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
function normalizeMenu(menu) {
    return {
        ...menu,
        items: (menu.items ?? []).map((item) => ({
            ...item,
            price: Number(item.price),
            product: item.product
                ? {
                    ...item.product,
                    price: Number(item.product.price),
                }
                : null,
        })),
    };
}
const menuInclude = {
    items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
            product: {
                include: {
                    category: true,
                },
            },
        },
    },
};
async function ensureProductsBelongToCompany(companyId, items = []) {
    const productIds = Array.from(new Set(items.map((item) => item.productId).filter(Boolean)));
    if (productIds.length === 0)
        return;
    const count = await prisma_1.prisma.product.count({
        where: {
            companyId,
            id: { in: productIds },
            deletedAt: null,
        },
    });
    if (count !== productIds.length)
        throw new Error('MENU_PRODUCT_NOT_FOUND');
}
async function listMenus(companyId) {
    const menus = await prisma_1.prisma.menu.findMany({
        where: { companyId },
        include: menuInclude,
        orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    });
    return menus.map(normalizeMenu);
}
async function getActiveMenu(companyId) {
    const menu = await prisma_1.prisma.menu.findFirst({
        where: { companyId, active: true },
        include: menuInclude,
    });
    return menu ? normalizeMenu(menu) : null;
}
async function getMenu(companyId, menuId) {
    const menu = await prisma_1.prisma.menu.findFirst({
        where: { id: menuId, companyId },
        include: menuInclude,
    });
    if (!menu)
        throw new Error('MENU_NOT_FOUND');
    return normalizeMenu(menu);
}
async function createMenu(companyId, input) {
    if (!input.name?.trim())
        throw new Error('MENU_NAME_REQUIRED');
    await ensureProductsBelongToCompany(companyId, input.items);
    const menu = await prisma_1.prisma.$transaction(async (tx) => {
        if (input.active) {
            await tx.menu.updateMany({ where: { companyId, active: true }, data: { active: false } });
        }
        return tx.menu.create({
            data: {
                companyId,
                name: input.name.trim(),
                description: input.description?.trim() || null,
                active: Boolean(input.active),
                items: {
                    create: (input.items ?? []).map((item, index) => ({
                        productId: item.productId,
                        price: new client_1.Prisma.Decimal(item.price ?? 0),
                        active: item.active ?? true,
                        sortOrder: item.sortOrder ?? index,
                    })),
                },
            },
            include: menuInclude,
        });
    });
    return normalizeMenu(menu);
}
async function duplicateMenu(companyId, menuId, input = {}) {
    const existing = await prisma_1.prisma.menu.findFirst({
        where: { id: menuId, companyId },
        include: menuInclude,
    });
    if (!existing)
        throw new Error('MENU_NOT_FOUND');
    const baseName = input.name?.trim() || `${existing.name} (cópia)`;
    await ensureProductsBelongToCompany(companyId, existing.items);
    const menu = await prisma_1.prisma.$transaction(async (tx) => {
        if (input.active) {
            await tx.menu.updateMany({ where: { companyId, active: true }, data: { active: false } });
        }
        return tx.menu.create({
            data: {
                companyId,
                name: baseName,
                description: existing.description,
                active: Boolean(input.active),
                items: {
                    create: (existing.items ?? []).map((item, index) => ({
                        productId: item.productId,
                        price: new client_1.Prisma.Decimal(item.price ?? 0),
                        active: item.active ?? true,
                        sortOrder: item.sortOrder ?? index,
                    })),
                },
            },
            include: menuInclude,
        });
    });
    return normalizeMenu(menu);
}
async function deactivateMenu(companyId, menuId) {
    const existing = await prisma_1.prisma.menu.findFirst({ where: { id: menuId, companyId } });
    if (!existing)
        throw new Error('MENU_NOT_FOUND');
    const menu = await prisma_1.prisma.menu.update({
        where: { id: menuId },
        data: { active: false },
        include: menuInclude,
    });
    return normalizeMenu(menu);
}
async function updateMenu(companyId, menuId, input) {
    const existing = await prisma_1.prisma.menu.findFirst({ where: { id: menuId, companyId } });
    if (!existing)
        throw new Error('MENU_NOT_FOUND');
    await ensureProductsBelongToCompany(companyId, input.items);
    const menu = await prisma_1.prisma.$transaction(async (tx) => {
        if (input.active) {
            await tx.menu.updateMany({ where: { companyId, active: true, id: { not: menuId } }, data: { active: false } });
        }
        if (input.items) {
            await tx.menuItem.deleteMany({ where: { menuId } });
        }
        return tx.menu.update({
            where: { id: menuId },
            data: {
                ...(typeof input.name === 'string' ? { name: input.name.trim() } : {}),
                ...(Object.prototype.hasOwnProperty.call(input, 'description')
                    ? { description: input.description?.trim() || null }
                    : {}),
                ...(typeof input.active === 'boolean' ? { active: input.active } : {}),
                ...(input.items
                    ? {
                        items: {
                            create: input.items.map((item, index) => ({
                                productId: item.productId,
                                price: new client_1.Prisma.Decimal(item.price ?? 0),
                                active: item.active ?? true,
                                sortOrder: item.sortOrder ?? index,
                            })),
                        },
                    }
                    : {}),
            },
            include: menuInclude,
        });
    });
    return normalizeMenu(menu);
}
async function activateMenu(companyId, menuId) {
    const existing = await prisma_1.prisma.menu.findFirst({ where: { id: menuId, companyId } });
    if (!existing)
        throw new Error('MENU_NOT_FOUND');
    const menu = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.menu.updateMany({ where: { companyId, active: true }, data: { active: false } });
        return tx.menu.update({ where: { id: menuId }, data: { active: true }, include: menuInclude });
    });
    return normalizeMenu(menu);
}
async function deleteMenu(companyId, menuId) {
    const existing = await prisma_1.prisma.menu.findFirst({ where: { id: menuId, companyId } });
    if (!existing)
        throw new Error('MENU_NOT_FOUND');
    if (existing.active)
        throw new Error('ACTIVE_MENU_CANNOT_BE_DELETED');
    await prisma_1.prisma.menu.delete({ where: { id: menuId } });
    return { ok: true };
}
