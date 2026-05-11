"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSuppliers = listSuppliers;
exports.getSupplier = getSupplier;
exports.createSupplier = createSupplier;
exports.updateSupplier = updateSupplier;
exports.deactivateSupplier = deactivateSupplier;
exports.createSupplierPriceTable = createSupplierPriceTable;
exports.updateSupplierPriceTable = updateSupplierPriceTable;
exports.deleteSupplierPriceTable = deleteSupplierPriceTable;
exports.createSupplierPriceTableItem = createSupplierPriceTableItem;
exports.updateSupplierPriceTableItem = updateSupplierPriceTableItem;
exports.deleteSupplierPriceTableItem = deleteSupplierPriceTableItem;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const SUPPLIER_INCLUDE = {
    priceTables: {
        orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
        include: {
            items: {
                orderBy: { itemName: 'asc' },
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            emoji: true,
                            stockUnit: true,
                            category: { select: { id: true, name: true, emoji: true } },
                        },
                    },
                },
            },
        },
    },
};
function cleanText(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function requiredText(value, field) {
    const cleaned = cleanText(value);
    if (!cleaned)
        throw new Error(`${field}_REQUIRED`);
    return cleaned;
}
function parseMoney(value, field) {
    const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(number) || number < 0)
        throw new Error(`${field}_INVALID`);
    return new client_1.Prisma.Decimal(number.toFixed(2));
}
function parseQuantity(value) {
    const number = typeof value === 'number' ? value : Number(String(value ?? '1').replace(',', '.'));
    if (!Number.isFinite(number) || number <= 0)
        throw new Error('QUANTITY_INVALID');
    return new client_1.Prisma.Decimal(number.toFixed(3));
}
function parseDate(value) {
    const cleaned = cleanText(value);
    if (!cleaned)
        return null;
    const date = new Date(cleaned);
    if (Number.isNaN(date.getTime()))
        throw new Error('DATE_INVALID');
    return date;
}
function parseUnit(value) {
    const unit = cleanText(value) ?? 'unit';
    if (!['unit', 'ml', 'l', 'g', 'kg'].includes(unit))
        throw new Error('UNIT_INVALID');
    return unit;
}
async function assertSupplier(companyId, supplierId) {
    const supplier = await prisma_1.prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
    if (!supplier)
        throw new Error('SUPPLIER_NOT_FOUND');
    return supplier;
}
async function assertPriceTable(companyId, supplierId, priceTableId) {
    await assertSupplier(companyId, supplierId);
    const table = await prisma_1.prisma.supplierPriceTable.findFirst({
        where: { id: priceTableId, supplier: { companyId, id: supplierId } },
    });
    if (!table)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    return table;
}
async function assertProductBelongsToCompany(companyId, productId) {
    if (!productId)
        return null;
    const product = await prisma_1.prisma.product.findFirst({ where: { id: productId, companyId, deletedAt: null } });
    if (!product)
        throw new Error('PRODUCT_NOT_FOUND');
    return product;
}
async function listSuppliers(companyId) {
    return prisma_1.prisma.supplier.findMany({
        where: { companyId },
        include: SUPPLIER_INCLUDE,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
}
async function getSupplier(companyId, supplierId) {
    const supplier = await prisma_1.prisma.supplier.findFirst({
        where: { id: supplierId, companyId },
        include: SUPPLIER_INCLUDE,
    });
    if (!supplier)
        throw new Error('SUPPLIER_NOT_FOUND');
    return supplier;
}
async function createSupplier(input) {
    const name = requiredText(input.name, 'SUPPLIER_NAME');
    const supplier = await prisma_1.prisma.supplier.create({
        data: {
            companyId: input.companyId,
            name,
            document: cleanText(input.document),
            contactName: cleanText(input.contactName),
            phone: cleanText(input.phone),
            email: cleanText(input.email),
            address: cleanText(input.address),
            notes: cleanText(input.notes),
            priceTables: input.createDefaultTable === false ? undefined : {
                create: { name: 'Tabela padrão' },
            },
        },
        include: SUPPLIER_INCLUDE,
    });
    return supplier;
}
async function updateSupplier(input) {
    await assertSupplier(input.companyId, input.supplierId);
    return prisma_1.prisma.supplier.update({
        where: { id: input.supplierId },
        data: {
            name: typeof input.name === 'string' ? requiredText(input.name, 'SUPPLIER_NAME') : undefined,
            document: typeof input.document === 'undefined' ? undefined : cleanText(input.document),
            contactName: typeof input.contactName === 'undefined' ? undefined : cleanText(input.contactName),
            phone: typeof input.phone === 'undefined' ? undefined : cleanText(input.phone),
            email: typeof input.email === 'undefined' ? undefined : cleanText(input.email),
            address: typeof input.address === 'undefined' ? undefined : cleanText(input.address),
            notes: typeof input.notes === 'undefined' ? undefined : cleanText(input.notes),
            active: typeof input.active === 'boolean' ? input.active : undefined,
        },
        include: SUPPLIER_INCLUDE,
    });
}
async function deactivateSupplier(companyId, supplierId) {
    await assertSupplier(companyId, supplierId);
    return prisma_1.prisma.supplier.update({
        where: { id: supplierId },
        data: { active: false },
        include: SUPPLIER_INCLUDE,
    });
}
async function createSupplierPriceTable(input) {
    await assertSupplier(input.companyId, input.supplierId);
    const table = await prisma_1.prisma.supplierPriceTable.create({
        data: {
            supplierId: input.supplierId,
            name: requiredText(input.name, 'PRICE_TABLE_NAME'),
            description: cleanText(input.description),
            validFrom: parseDate(input.validFrom),
            validUntil: parseDate(input.validUntil),
        },
    });
    return getSupplier(input.companyId, input.supplierId);
}
async function updateSupplierPriceTable(input) {
    await assertPriceTable(input.companyId, input.supplierId, input.priceTableId);
    await prisma_1.prisma.supplierPriceTable.update({
        where: { id: input.priceTableId },
        data: {
            name: typeof input.name === 'string' ? requiredText(input.name, 'PRICE_TABLE_NAME') : undefined,
            description: typeof input.description === 'undefined' ? undefined : cleanText(input.description),
            active: typeof input.active === 'boolean' ? input.active : undefined,
            validFrom: typeof input.validFrom === 'undefined' ? undefined : parseDate(input.validFrom),
            validUntil: typeof input.validUntil === 'undefined' ? undefined : parseDate(input.validUntil),
        },
    });
    return getSupplier(input.companyId, input.supplierId);
}
async function deleteSupplierPriceTable(input) {
    await assertPriceTable(input.companyId, input.supplierId, input.priceTableId);
    await prisma_1.prisma.supplierPriceTable.delete({ where: { id: input.priceTableId } });
    return getSupplier(input.companyId, input.supplierId);
}
async function createSupplierPriceTableItem(input) {
    await assertPriceTable(input.companyId, input.supplierId, input.priceTableId);
    const productId = cleanText(input.productId);
    const product = await assertProductBelongsToCompany(input.companyId, productId);
    await prisma_1.prisma.supplierPriceTableItem.create({
        data: {
            priceTableId: input.priceTableId,
            productId,
            itemName: requiredText(input.itemName ?? product?.name, 'ITEM_NAME'),
            sku: cleanText(input.sku),
            unit: parseUnit(input.unit ?? product?.stockUnit ?? 'unit'),
            quantity: parseQuantity(input.quantity),
            unitPrice: parseMoney(input.unitPrice, 'UNIT_PRICE'),
            notes: cleanText(input.notes),
            lastQuotedAt: parseDate(input.lastQuotedAt) ?? new Date(),
        },
    });
    return getSupplier(input.companyId, input.supplierId);
}
async function updateSupplierPriceTableItem(input) {
    await assertPriceTable(input.companyId, input.supplierId, input.priceTableId);
    const existing = await prisma_1.prisma.supplierPriceTableItem.findFirst({
        where: { id: input.itemId, priceTableId: input.priceTableId },
    });
    if (!existing)
        throw new Error('PRICE_TABLE_ITEM_NOT_FOUND');
    const productId = typeof input.productId === 'undefined' ? undefined : cleanText(input.productId);
    const product = typeof productId === 'undefined' ? null : await assertProductBelongsToCompany(input.companyId, productId);
    await prisma_1.prisma.supplierPriceTableItem.update({
        where: { id: input.itemId },
        data: {
            productId,
            itemName: typeof input.itemName === 'undefined' && typeof productId === 'undefined'
                ? undefined
                : requiredText(input.itemName ?? product?.name ?? existing.itemName, 'ITEM_NAME'),
            sku: typeof input.sku === 'undefined' ? undefined : cleanText(input.sku),
            unit: typeof input.unit === 'undefined' ? undefined : parseUnit(input.unit),
            quantity: typeof input.quantity === 'undefined' ? undefined : parseQuantity(input.quantity),
            unitPrice: typeof input.unitPrice === 'undefined' ? undefined : parseMoney(input.unitPrice, 'UNIT_PRICE'),
            notes: typeof input.notes === 'undefined' ? undefined : cleanText(input.notes),
            lastQuotedAt: typeof input.lastQuotedAt === 'undefined' ? undefined : parseDate(input.lastQuotedAt),
        },
    });
    return getSupplier(input.companyId, input.supplierId);
}
async function deleteSupplierPriceTableItem(input) {
    await assertPriceTable(input.companyId, input.supplierId, input.priceTableId);
    await prisma_1.prisma.supplierPriceTableItem.deleteMany({
        where: { id: input.itemId, priceTableId: input.priceTableId },
    });
    return getSupplier(input.companyId, input.supplierId);
}
