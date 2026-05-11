"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = getDashboard;
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.updateAvailability = updateAvailability;
exports.listProducts = listProducts;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.adjustProductStock = adjustProductStock;
exports.listPriceTables = listPriceTables;
exports.createPriceTable = createPriceTable;
exports.updatePriceTable = updatePriceTable;
exports.deletePriceTable = deletePriceTable;
exports.createPriceTableItem = createPriceTableItem;
exports.createPriceTableItemFromExisting = createPriceTableItemFromExisting;
exports.updatePriceTableItem = updatePriceTableItem;
exports.deletePriceTableItem = deletePriceTableItem;
exports.duplicatePriceTable = duplicatePriceTable;
exports.bulkAdjustPriceTablePrices = bulkAdjustPriceTablePrices;
exports.updateItemStock = updateItemStock;
exports.togglePriceTableItemActive = togglePriceTableItemActive;
exports.adjustItemStock = adjustItemStock;
exports.listOrders = listOrders;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const DAY_LABELS = {
    sun: 'Domingo',
    mon: 'Segunda',
    tue: 'Terça',
    wed: 'Quarta',
    thu: 'Quinta',
    fri: 'Sexta',
    sat: 'Sábado',
};
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_OPERATING_HOURS = DAY_KEYS.map((day) => ({
    day,
    label: DAY_LABELS[day],
    enabled: day !== 'sun',
    startTime: day === 'sat' ? '09:00' : '08:00',
    endTime: day === 'sat' ? '14:00' : '18:00',
}));
const SUPPLIER_INCLUDE = {
    catalogProducts: {
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
    },
    priceTables: {
        orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
        include: {
            items: {
                orderBy: { itemName: 'asc' },
                include: {
                    supplierProduct: true,
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
function parseStockQuantity(value) {
    const number = typeof value === 'number' ? value : Number(String(value ?? '0').replace(',', '.'));
    if (!Number.isFinite(number) || number < 0)
        throw new Error('STOCK_QUANTITY_INVALID');
    return new client_1.Prisma.Decimal(number.toFixed(3));
}
function parseUnit(value) {
    const unit = cleanText(value) ?? 'unit';
    const normalized = unit === 'un.' ? 'unit' : unit;
    if (!['unit', 'ml', 'l', 'g', 'kg'].includes(normalized))
        throw new Error('UNIT_INVALID');
    return normalized;
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
function decimalToNumber(value) {
    if (value == null)
        return 0;
    return Number(value);
}
function normalizeOperatingHours(value) {
    const source = Array.isArray(value) ? value : DEFAULT_OPERATING_HOURS;
    const byDay = new Map(source.map((item) => [String(item?.day), item]));
    return DAY_KEYS.map((day) => {
        const item = byDay.get(day);
        return {
            day,
            label: DAY_LABELS[day],
            enabled: typeof item?.enabled === 'boolean' ? item.enabled : day !== 'sun',
            startTime: isTime(item?.startTime) ? item.startTime : day === 'sat' ? '09:00' : '08:00',
            endTime: isTime(item?.endTime) ? item.endTime : day === 'sat' ? '14:00' : '18:00',
        };
    });
}
function isTime(value) {
    return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}
function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
function getTodayKey(date = new Date()) {
    return DAY_KEYS[date.getDay()];
}
function isInsideWindow(nowMinutes, startTime, endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start === end)
        return true;
    if (start < end)
        return nowMinutes >= start && nowMinutes <= end;
    return nowMinutes >= start || nowMinutes <= end;
}
function computeOnlineStatus(supplier) {
    const hours = normalizeOperatingHours(supplier.operatingHours);
    const now = new Date();
    const today = hours.find((item) => item.day === getTodayKey(now));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const insideOperatingHours = Boolean(today?.enabled && isInsideWindow(nowMinutes, today.startTime, today.endTime));
    return {
        onlineEnabled: Boolean(supplier.onlineEnabled),
        insideOperatingHours,
        isOnline: Boolean(supplier.onlineEnabled) && insideOperatingHours,
        today,
    };
}
async function generateSupplierCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 20; attempt += 1) {
        let code = '';
        for (let i = 0; i < 8; i += 1)
            code += alphabet[Math.floor(Math.random() * alphabet.length)];
        const existing = await prisma_1.prisma.supplier.findUnique({ where: { ordrCode: code } });
        if (!existing)
            return code;
    }
    throw new Error('SUPPLIER_CODE_GENERATION_FAILED');
}
async function assertSupplierCompany(companyId) {
    const company = await prisma_1.prisma.company.findUnique({ where: { id: companyId } });
    if (!company)
        throw new Error('COMPANY_NOT_FOUND');
    if (String(company.companyType ?? 'BUSINESS') !== 'SUPPLIER')
        throw new Error('SUPPLIER_COMPANY_REQUIRED');
    return company;
}
async function ensureSupplierProfile(companyId) {
    const company = await assertSupplierCompany(companyId);
    const existing = await prisma_1.prisma.supplier.findFirst({
        where: { OR: [{ supplierCompanyId: companyId }, { companyId, name: company.name }] },
        include: SUPPLIER_INCLUDE,
    });
    if (existing) {
        const needsPatch = !existing.supplierCompanyId || !existing.ordrCode || !existing.operatingHours;
        if (!needsPatch)
            return existing;
        return prisma_1.prisma.supplier.update({
            where: { id: existing.id },
            data: {
                supplierCompanyId: existing.supplierCompanyId ?? companyId,
                ordrCode: existing.ordrCode ?? await generateSupplierCode(),
                operatingHours: existing.operatingHours ?? DEFAULT_OPERATING_HOURS,
            },
            include: SUPPLIER_INCLUDE,
        });
    }
    return prisma_1.prisma.supplier.create({
        data: {
            companyId,
            supplierCompanyId: companyId,
            name: company.name,
            ordrCode: await generateSupplierCode(),
            categories: [],
            onlineEnabled: true,
            publicListingEnabled: false,
            automaticAvailability: true,
            operatingHours: DEFAULT_OPERATING_HOURS,
            priceTables: { create: { name: 'Tabela padrão' } },
        },
        include: SUPPLIER_INCLUDE,
    });
}
function parseCategories(value) {
    if (Array.isArray(value))
        return value.map((item) => cleanText(item)).filter((item) => Boolean(item)).slice(0, 12);
    if (typeof value === 'string')
        return value.split(',').map((item) => cleanText(item)).filter((item) => Boolean(item)).slice(0, 12);
    return [];
}
function serializeSupplier(supplier) {
    return {
        id: supplier.id,
        name: supplier.name,
        document: supplier.document ?? null,
        contactName: supplier.contactName ?? null,
        phone: supplier.phone ?? null,
        email: supplier.email ?? null,
        address: supplier.address ?? null,
        notes: supplier.notes ?? null,
        photoUrl: supplier.photoUrl ?? null,
        photoData: supplier.photoData ?? null,
        categories: supplier.categories ?? [],
        active: supplier.active,
        ordrCode: supplier.ordrCode ?? null,
        onlineEnabled: Boolean(supplier.onlineEnabled),
        publicListingEnabled: Boolean(supplier.publicListingEnabled),
        automaticAvailability: Boolean(supplier.automaticAvailability ?? true),
        operatingHours: normalizeOperatingHours(supplier.operatingHours),
        onlineStatus: computeOnlineStatus(supplier),
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
    };
}
function serializeCatalogProduct(product) {
    return {
        id: product.id,
        itemName: product.name,
        name: product.name,
        sku: product.sku ?? null,
        category: product.category ?? null,
        unit: product.unit,
        quantity: decimalToNumber(product.quantity),
        unitPrice: decimalToNumber(product.unitPrice),
        price: decimalToNumber(product.unitPrice),
        notes: product.notes ?? null,
        active: Boolean(product.active ?? true),
        stockEnabled: Boolean(product.stockEnabled),
        stockQuantity: decimalToNumber(product.stockQuantity),
        minStockQuantity: decimalToNumber(product.minStockQuantity),
        lowStock: Boolean(product.stockEnabled) && decimalToNumber(product.stockQuantity) <= decimalToNumber(product.minStockQuantity),
        stockUpdatedAt: product.stockUpdatedAt ?? null,
        isCatalogProduct: true,
    };
}
function serializeItem(item) {
    const catalog = item.supplierProduct;
    return {
        id: item.id,
        tableItemId: item.id,
        priceTableId: item.priceTableId,
        supplierProductId: item.supplierProductId ?? null,
        productId: item.productId ?? null,
        itemName: item.itemName,
        name: item.itemName,
        sku: item.sku ?? catalog?.sku ?? null,
        category: item.category ?? catalog?.category ?? item.product?.category?.name ?? null,
        unit: item.unit,
        quantity: decimalToNumber(item.quantity),
        unitPrice: decimalToNumber(item.unitPrice),
        price: decimalToNumber(item.unitPrice),
        notes: item.notes ?? catalog?.notes ?? null,
        active: Boolean(item.active ?? true),
        stockEnabled: Boolean(item.stockEnabled),
        stockQuantity: decimalToNumber(item.stockQuantity),
        minStockQuantity: decimalToNumber(item.minStockQuantity),
        lowStock: Boolean(item.stockEnabled) && decimalToNumber(item.stockQuantity) <= decimalToNumber(item.minStockQuantity),
        stockUpdatedAt: item.stockUpdatedAt ?? null,
        lastQuotedAt: item.lastQuotedAt ?? null,
        linkedStockProductName: item.product?.name ?? null,
        categoryEmoji: item.product?.category?.emoji ?? null,
        isCatalogProduct: false,
    };
}
function serializeTable(table) {
    const items = Array.isArray(table.items) ? table.items : [];
    const averagePrice = items.length ? items.reduce((total, item) => total + decimalToNumber(item.unitPrice), 0) / items.length : 0;
    return {
        id: table.id,
        name: table.name,
        description: table.description ?? null,
        active: table.active,
        validFrom: table.validFrom ?? null,
        validUntil: table.validUntil ?? null,
        updatedAt: table.updatedAt,
        itemCount: items.length,
        averagePrice,
        items: items.map(serializeItem),
    };
}
function serializePortal(supplier) {
    const profile = serializeSupplier(supplier);
    const tables = (supplier.priceTables ?? []).map(serializeTable);
    const products = (supplier.catalogProducts ?? []).map(serializeCatalogProduct);
    return { profile, tables, products };
}
function productPayload(input) {
    return {
        name: requiredText(input.name ?? input.itemName, 'PRODUCT_NAME'),
        sku: cleanText(input.sku),
        category: cleanText(input.category),
        unit: parseUnit(input.unit),
        quantity: parseQuantity(input.quantity),
        unitPrice: parseMoney(input.unitPrice ?? input.price ?? 0, 'UNIT_PRICE'),
        notes: cleanText(input.notes),
        active: typeof input.active === 'boolean' ? input.active : true,
        stockEnabled: typeof input.stockEnabled === 'boolean' ? input.stockEnabled : false,
        stockQuantity: parseStockQuantity(input.stockQuantity ?? 0),
        minStockQuantity: parseStockQuantity(input.minStockQuantity ?? 0),
        stockUpdatedAt: typeof input.stockQuantity === 'undefined' ? null : new Date(),
    };
}
function tableItemDataFromProduct(product, input = {}) {
    const adjustment = typeof input.priceAdjustmentPercent === 'undefined' || input.priceAdjustmentPercent === null || input.priceAdjustmentPercent === ''
        ? 0
        : Number(String(input.priceAdjustmentPercent).replace(',', '.'));
    if (!Number.isFinite(adjustment))
        throw new Error('PRICE_ADJUSTMENT_INVALID');
    const nextPrice = Math.max(0, decimalToNumber(input.unitPrice ?? input.price ?? product.unitPrice) * (1 + adjustment / 100));
    return {
        supplierProductId: product.id,
        itemName: cleanText(input.itemName ?? input.name) ?? product.name,
        sku: typeof input.sku === 'undefined' ? product.sku : cleanText(input.sku),
        category: typeof input.category === 'undefined' ? product.category : cleanText(input.category),
        unit: typeof input.unit === 'undefined' ? product.unit : parseUnit(input.unit),
        quantity: typeof input.quantity === 'undefined' ? product.quantity : parseQuantity(input.quantity),
        unitPrice: new client_1.Prisma.Decimal(nextPrice.toFixed(2)),
        notes: typeof input.notes === 'undefined' ? product.notes : cleanText(input.notes),
        active: typeof input.active === 'boolean' ? input.active : Boolean(product.active ?? true),
        stockEnabled: Boolean(input.stockEnabled ?? product.stockEnabled),
        stockQuantity: typeof input.stockQuantity === 'undefined' ? product.stockQuantity : parseStockQuantity(input.stockQuantity),
        minStockQuantity: typeof input.minStockQuantity === 'undefined' ? product.minStockQuantity : parseStockQuantity(input.minStockQuantity),
        stockUpdatedAt: new Date(),
        lastQuotedAt: new Date(),
    };
}
async function getDashboard(companyId) {
    const supplier = await ensureSupplierProfile(companyId);
    const { profile, tables, products } = serializePortal(supplier);
    const activeTables = tables.filter((table) => table.active);
    const productsInActiveTables = activeTables.flatMap((table) => table.items).filter((item) => item.active);
    const lowStockProducts = products.filter((product) => product.lowStock).length;
    return {
        supplier: profile,
        pendingOrders: 0,
        monthlyRevenue: 0,
        activePriceTables: activeTables.length,
        linkedProducts: productsInActiveTables.length,
        productCount: products.filter((product) => product.active).length,
        lowStockProducts,
        categories: profile.categories,
        onlineStatus: profile.onlineStatus,
        recentOrders: [],
        highlights: [
            { label: 'Código ORDR', value: profile.ordrCode ?? '-' },
            { label: 'Produtos cadastrados', value: String(products.length) },
            { label: 'Produtos em tabelas', value: String(productsInActiveTables.length) },
            { label: 'Tabelas ativas', value: String(activeTables.length) },
            { label: 'Estoque baixo', value: String(lowStockProducts) },
        ],
    };
}
async function getProfile(companyId) {
    const supplier = await ensureSupplierProfile(companyId);
    return { supplier: serializeSupplier(supplier) };
}
async function updateProfile(companyId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const updated = await prisma_1.prisma.supplier.update({
        where: { id: supplier.id },
        data: {
            name: typeof input.name === 'string' ? requiredText(input.name, 'SUPPLIER_NAME') : undefined,
            document: typeof input.document === 'undefined' ? undefined : cleanText(input.document),
            contactName: typeof input.contactName === 'undefined' ? undefined : cleanText(input.contactName),
            phone: typeof input.phone === 'undefined' ? undefined : cleanText(input.phone),
            email: typeof input.email === 'undefined' ? undefined : cleanText(input.email),
            address: typeof input.address === 'undefined' ? undefined : cleanText(input.address),
            notes: typeof input.notes === 'undefined' ? undefined : cleanText(input.notes),
            photoUrl: typeof input.photoUrl === 'undefined' ? undefined : cleanText(input.photoUrl),
            photoData: typeof input.photoData === 'undefined' ? undefined : cleanText(input.photoData),
            categories: typeof input.categories === 'undefined' ? undefined : parseCategories(input.categories),
            onlineEnabled: typeof input.onlineEnabled === 'boolean' ? input.onlineEnabled : undefined,
            publicListingEnabled: typeof input.publicListingEnabled === 'boolean' ? input.publicListingEnabled : undefined,
            automaticAvailability: typeof input.automaticAvailability === 'boolean' ? input.automaticAvailability : undefined,
            operatingHours: typeof input.operatingHours === 'undefined' ? undefined : normalizeOperatingHours(input.operatingHours),
        },
        include: SUPPLIER_INCLUDE,
    });
    return { supplier: serializeSupplier(updated) };
}
async function updateAvailability(companyId, onlineEnabled) {
    return updateProfile(companyId, { onlineEnabled });
}
async function listProducts(companyId) {
    const supplier = await ensureSupplierProfile(companyId);
    const { products } = serializePortal(supplier);
    return { products };
}
async function createProduct(companyId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    await prisma_1.prisma.supplierCatalogProduct.create({ data: { supplierId: supplier.id, ...productPayload(input) } });
    return listProducts(companyId);
}
async function updateProduct(companyId, productId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const product = await prisma_1.prisma.supplierCatalogProduct.findFirst({ where: { id: productId, supplierId: supplier.id } });
    if (!product)
        throw new Error('SUPPLIER_PRODUCT_NOT_FOUND');
    await prisma_1.prisma.supplierCatalogProduct.update({
        where: { id: productId },
        data: {
            name: typeof input.name !== 'undefined' || typeof input.itemName !== 'undefined' ? requiredText(input.name ?? input.itemName, 'PRODUCT_NAME') : undefined,
            sku: typeof input.sku === 'undefined' ? undefined : cleanText(input.sku),
            category: typeof input.category === 'undefined' ? undefined : cleanText(input.category),
            unit: typeof input.unit === 'undefined' ? undefined : parseUnit(input.unit),
            quantity: typeof input.quantity === 'undefined' ? undefined : parseQuantity(input.quantity),
            unitPrice: typeof input.unitPrice === 'undefined' && typeof input.price === 'undefined' ? undefined : parseMoney(input.unitPrice ?? input.price, 'UNIT_PRICE'),
            notes: typeof input.notes === 'undefined' ? undefined : cleanText(input.notes),
            active: typeof input.active === 'undefined' ? undefined : Boolean(input.active),
            stockEnabled: typeof input.stockEnabled === 'undefined' ? undefined : Boolean(input.stockEnabled),
            stockQuantity: typeof input.stockQuantity === 'undefined' ? undefined : parseStockQuantity(input.stockQuantity),
            minStockQuantity: typeof input.minStockQuantity === 'undefined' ? undefined : parseStockQuantity(input.minStockQuantity),
            stockUpdatedAt: typeof input.stockQuantity === 'undefined' ? undefined : new Date(),
        },
    });
    return listProducts(companyId);
}
async function deleteProduct(companyId, productId) {
    const supplier = await ensureSupplierProfile(companyId);
    const product = await prisma_1.prisma.supplierCatalogProduct.findFirst({ where: { id: productId, supplierId: supplier.id } });
    if (!product)
        throw new Error('SUPPLIER_PRODUCT_NOT_FOUND');
    await prisma_1.prisma.supplierCatalogProduct.delete({ where: { id: productId } });
    return listProducts(companyId);
}
async function adjustProductStock(companyId, productId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const product = await prisma_1.prisma.supplierCatalogProduct.findFirst({ where: { id: productId, supplierId: supplier.id } });
    if (!product)
        throw new Error('SUPPLIER_PRODUCT_NOT_FOUND');
    const current = decimalToNumber(product.stockQuantity);
    const hasSetValue = typeof input?.stockQuantity !== 'undefined' && input?.mode === 'set';
    const delta = typeof input?.delta === 'undefined' || input?.delta === null || input?.delta === '' ? 0 : Number(String(input.delta).replace(',', '.'));
    if (!Number.isFinite(delta))
        throw new Error('STOCK_DELTA_INVALID');
    const nextQuantity = hasSetValue ? decimalToNumber(parseStockQuantity(input.stockQuantity)) : Math.max(0, current + delta);
    await prisma_1.prisma.supplierCatalogProduct.update({
        where: { id: productId },
        data: {
            stockEnabled: true,
            stockQuantity: new client_1.Prisma.Decimal(nextQuantity.toFixed(3)),
            minStockQuantity: typeof input?.minStockQuantity === 'undefined' ? undefined : parseStockQuantity(input.minStockQuantity),
            stockUpdatedAt: new Date(),
        },
    });
    return listProducts(companyId);
}
async function listPriceTables(companyId) {
    const supplier = await ensureSupplierProfile(companyId);
    const { tables } = serializePortal(supplier);
    return { tables };
}
async function createPriceTable(companyId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const includeAllProducts = Boolean(input.includeAllProducts ?? input.createWithAllProducts);
    const adjustment = typeof input.priceAdjustmentPercent === 'undefined' || input.priceAdjustmentPercent === null || input.priceAdjustmentPercent === ''
        ? 0
        : Number(String(input.priceAdjustmentPercent).replace(',', '.'));
    if (!Number.isFinite(adjustment))
        throw new Error('PRICE_ADJUSTMENT_INVALID');
    await prisma_1.prisma.supplierPriceTable.create({
        data: {
            supplierId: supplier.id,
            name: requiredText(input.name, 'PRICE_TABLE_NAME'),
            description: cleanText(input.description),
            active: typeof input.active === 'boolean' ? input.active : true,
            validFrom: parseDate(input.validFrom),
            validUntil: parseDate(input.validUntil),
            items: includeAllProducts
                ? {
                    create: (supplier.catalogProducts ?? []).filter((product) => product.active).map((product) => tableItemDataFromProduct(product, { priceAdjustmentPercent: adjustment })),
                }
                : undefined,
        },
    });
    return listPriceTables(companyId);
}
async function updatePriceTable(companyId, tableId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const table = await prisma_1.prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } });
    if (!table)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    await prisma_1.prisma.supplierPriceTable.update({
        where: { id: tableId },
        data: {
            name: typeof input.name === 'string' ? requiredText(input.name, 'PRICE_TABLE_NAME') : undefined,
            description: typeof input.description === 'undefined' ? undefined : cleanText(input.description),
            active: typeof input.active === 'boolean' ? input.active : undefined,
            validFrom: typeof input.validFrom === 'undefined' ? undefined : parseDate(input.validFrom),
            validUntil: typeof input.validUntil === 'undefined' ? undefined : parseDate(input.validUntil),
        },
    });
    return listPriceTables(companyId);
}
async function deletePriceTable(companyId, tableId) {
    const supplier = await ensureSupplierProfile(companyId);
    const table = await prisma_1.prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } });
    if (!table)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    await prisma_1.prisma.supplierPriceTable.delete({ where: { id: tableId } });
    return listPriceTables(companyId);
}
async function createPriceTableItem(companyId, tableId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const table = await prisma_1.prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } });
    if (!table)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    let supplierProduct = null;
    if (input.supplierProductId || input.productId) {
        supplierProduct = await prisma_1.prisma.supplierCatalogProduct.findFirst({ where: { id: input.supplierProductId ?? input.productId, supplierId: supplier.id } });
        if (!supplierProduct)
            throw new Error('SUPPLIER_PRODUCT_NOT_FOUND');
    }
    await prisma_1.prisma.supplierPriceTableItem.create({
        data: supplierProduct
            ? { priceTableId: tableId, ...tableItemDataFromProduct(supplierProduct, input) }
            : {
                priceTableId: tableId,
                itemName: requiredText(input.itemName ?? input.name, 'ITEM_NAME'),
                sku: cleanText(input.sku),
                category: cleanText(input.category),
                unit: parseUnit(input.unit),
                quantity: parseQuantity(input.quantity),
                unitPrice: parseMoney(input.unitPrice ?? input.price, 'UNIT_PRICE'),
                notes: cleanText(input.notes),
                active: typeof input.active === 'boolean' ? input.active : true,
                stockEnabled: typeof input.stockEnabled === 'boolean' ? input.stockEnabled : false,
                stockQuantity: parseStockQuantity(input.stockQuantity ?? 0),
                minStockQuantity: parseStockQuantity(input.minStockQuantity ?? 0),
                stockUpdatedAt: typeof input.stockQuantity === 'undefined' ? null : new Date(),
                lastQuotedAt: parseDate(input.lastQuotedAt) ?? new Date(),
            },
    });
    return listPriceTables(companyId);
}
async function createPriceTableItemFromExisting(companyId, tableId, input) {
    const productId = input.productId ?? input.supplierProductId ?? input.sourceProductId;
    if (productId)
        return createPriceTableItem(companyId, tableId, { ...input, supplierProductId: productId });
    // Legacy path: copy from an existing table item.
    const supplier = await ensureSupplierProfile(companyId);
    const targetTable = await prisma_1.prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } });
    if (!targetTable)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    const sourceItemId = requiredText(input.sourceItemId, 'SOURCE_ITEM_ID');
    const source = await prisma_1.prisma.supplierPriceTableItem.findFirst({ where: { id: sourceItemId, priceTable: { supplierId: supplier.id } } });
    if (!source)
        throw new Error('SOURCE_ITEM_NOT_FOUND');
    await prisma_1.prisma.supplierPriceTableItem.create({
        data: {
            priceTableId: tableId,
            supplierProductId: source.supplierProductId,
            productId: source.productId,
            itemName: cleanText(input.itemName) ?? source.itemName,
            sku: typeof input.sku === 'undefined' ? source.sku : cleanText(input.sku),
            category: typeof input.category === 'undefined' ? source.category : cleanText(input.category),
            unit: typeof input.unit === 'undefined' ? source.unit : parseUnit(input.unit),
            quantity: typeof input.quantity === 'undefined' ? source.quantity : parseQuantity(input.quantity),
            unitPrice: typeof input.unitPrice === 'undefined' && typeof input.priceAdjustmentPercent === 'undefined'
                ? source.unitPrice
                : parseMoney(input.unitPrice ?? decimalToNumber(source.unitPrice) * (1 + Number(input.priceAdjustmentPercent ?? 0) / 100), 'UNIT_PRICE'),
            notes: typeof input.notes === 'undefined' ? source.notes : cleanText(input.notes),
            active: typeof input.active === 'boolean' ? input.active : true,
            stockEnabled: Boolean(input.stockEnabled ?? source.stockEnabled),
            stockQuantity: typeof input.stockQuantity === 'undefined' ? source.stockQuantity : parseStockQuantity(input.stockQuantity),
            minStockQuantity: typeof input.minStockQuantity === 'undefined' ? source.minStockQuantity : parseStockQuantity(input.minStockQuantity),
            stockUpdatedAt: new Date(),
            lastQuotedAt: new Date(),
        },
    });
    return listPriceTables(companyId);
}
async function updatePriceTableItem(companyId, tableId, itemId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const table = await prisma_1.prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } });
    if (!table)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    const item = await prisma_1.prisma.supplierPriceTableItem.findFirst({ where: { id: itemId, priceTableId: tableId } });
    if (!item)
        throw new Error('PRICE_TABLE_ITEM_NOT_FOUND');
    await prisma_1.prisma.supplierPriceTableItem.update({
        where: { id: itemId },
        data: {
            itemName: typeof input.itemName !== 'undefined' || typeof input.name !== 'undefined' ? requiredText(input.itemName ?? input.name, 'ITEM_NAME') : undefined,
            sku: typeof input.sku === 'undefined' ? undefined : cleanText(input.sku),
            category: typeof input.category === 'undefined' ? undefined : cleanText(input.category),
            unit: typeof input.unit === 'undefined' ? undefined : parseUnit(input.unit),
            quantity: typeof input.quantity === 'undefined' ? undefined : parseQuantity(input.quantity),
            unitPrice: typeof input.unitPrice === 'undefined' && typeof input.price === 'undefined' ? undefined : parseMoney(input.unitPrice ?? input.price, 'UNIT_PRICE'),
            notes: typeof input.notes === 'undefined' ? undefined : cleanText(input.notes),
            active: typeof input.active === 'undefined' ? undefined : Boolean(input.active),
            stockEnabled: typeof input.stockEnabled === 'undefined' ? undefined : Boolean(input.stockEnabled),
            stockQuantity: typeof input.stockQuantity === 'undefined' ? undefined : parseStockQuantity(input.stockQuantity),
            minStockQuantity: typeof input.minStockQuantity === 'undefined' ? undefined : parseStockQuantity(input.minStockQuantity),
            stockUpdatedAt: typeof input.stockQuantity === 'undefined' ? undefined : new Date(),
            lastQuotedAt: typeof input.lastQuotedAt === 'undefined' ? undefined : parseDate(input.lastQuotedAt),
        },
    });
    return listPriceTables(companyId);
}
async function deletePriceTableItem(companyId, tableId, itemId) {
    const supplier = await ensureSupplierProfile(companyId);
    const table = await prisma_1.prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id } });
    if (!table)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    await prisma_1.prisma.supplierPriceTableItem.deleteMany({ where: { id: itemId, priceTableId: tableId } });
    return listPriceTables(companyId);
}
async function duplicatePriceTable(companyId, tableId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const table = await prisma_1.prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id }, include: { items: true } });
    if (!table)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    const adjustment = typeof input.priceAdjustmentPercent === 'undefined' || input.priceAdjustmentPercent === null || input.priceAdjustmentPercent === '' ? 0 : Number(String(input.priceAdjustmentPercent).replace(',', '.'));
    if (!Number.isFinite(adjustment))
        throw new Error('PRICE_ADJUSTMENT_INVALID');
    const name = cleanText(input.name) ?? `${table.name} - cópia`;
    await prisma_1.prisma.supplierPriceTable.create({
        data: {
            supplierId: supplier.id,
            name,
            description: typeof input.description === 'undefined' ? table.description : cleanText(input.description),
            active: typeof input.active === 'boolean' ? input.active : false,
            validFrom: parseDate(input.validFrom),
            validUntil: parseDate(input.validUntil),
            items: {
                create: table.items.map((item) => {
                    const nextPrice = Math.max(0, decimalToNumber(item.unitPrice) * (1 + adjustment / 100));
                    return {
                        supplierProductId: item.supplierProductId,
                        productId: item.productId,
                        itemName: item.itemName,
                        sku: item.sku,
                        category: item.category,
                        unit: item.unit,
                        quantity: item.quantity,
                        unitPrice: new client_1.Prisma.Decimal(nextPrice.toFixed(2)),
                        notes: item.notes,
                        active: item.active ?? true,
                        stockEnabled: item.stockEnabled,
                        stockQuantity: item.stockQuantity,
                        minStockQuantity: item.minStockQuantity,
                        stockUpdatedAt: item.stockUpdatedAt,
                        lastQuotedAt: new Date(),
                    };
                }),
            },
        },
    });
    return listPriceTables(companyId);
}
async function bulkAdjustPriceTablePrices(companyId, tableId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const table = await prisma_1.prisma.supplierPriceTable.findFirst({ where: { id: tableId, supplierId: supplier.id }, include: { items: true } });
    if (!table)
        throw new Error('PRICE_TABLE_NOT_FOUND');
    const adjustment = Number(String(input.priceAdjustmentPercent ?? '').replace(',', '.'));
    if (!Number.isFinite(adjustment))
        throw new Error('PRICE_ADJUSTMENT_INVALID');
    await prisma_1.prisma.$transaction(table.items.map((item) => {
        const nextPrice = Math.max(0, decimalToNumber(item.unitPrice) * (1 + adjustment / 100));
        return prisma_1.prisma.supplierPriceTableItem.update({ where: { id: item.id }, data: { unitPrice: new client_1.Prisma.Decimal(nextPrice.toFixed(2)), lastQuotedAt: new Date() } });
    }));
    return listPriceTables(companyId);
}
async function updateItemStock(companyId, tableId, itemId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const item = await prisma_1.prisma.supplierPriceTableItem.findFirst({ where: { id: itemId, priceTableId: tableId, priceTable: { supplierId: supplier.id } } });
    if (!item)
        throw new Error('PRICE_TABLE_ITEM_NOT_FOUND');
    await prisma_1.prisma.supplierPriceTableItem.update({
        where: { id: itemId },
        data: {
            stockEnabled: typeof input.stockEnabled === 'undefined' ? undefined : Boolean(input.stockEnabled),
            stockQuantity: typeof input.stockQuantity === 'undefined' ? undefined : parseStockQuantity(input.stockQuantity),
            minStockQuantity: typeof input.minStockQuantity === 'undefined' ? undefined : parseStockQuantity(input.minStockQuantity),
            stockUpdatedAt: new Date(),
        },
    });
    return listPriceTables(companyId);
}
async function togglePriceTableItemActive(companyId, tableId, itemId, input) {
    return updatePriceTableItem(companyId, tableId, itemId, { active: Boolean(input?.active) });
}
async function adjustItemStock(companyId, tableId, itemId, input) {
    const supplier = await ensureSupplierProfile(companyId);
    const item = await prisma_1.prisma.supplierPriceTableItem.findFirst({ where: { id: itemId, priceTableId: tableId, priceTable: { supplierId: supplier.id } } });
    if (!item)
        throw new Error('PRICE_TABLE_ITEM_NOT_FOUND');
    const current = decimalToNumber(item.stockQuantity);
    const hasSetValue = typeof input?.stockQuantity !== 'undefined' && input?.mode === 'set';
    const delta = typeof input?.delta === 'undefined' || input?.delta === null || input?.delta === '' ? 0 : Number(String(input.delta).replace(',', '.'));
    if (!Number.isFinite(delta))
        throw new Error('STOCK_DELTA_INVALID');
    const nextQuantity = hasSetValue ? decimalToNumber(parseStockQuantity(input.stockQuantity)) : Math.max(0, current + delta);
    await prisma_1.prisma.supplierPriceTableItem.update({
        where: { id: itemId },
        data: {
            stockEnabled: true,
            stockQuantity: new client_1.Prisma.Decimal(nextQuantity.toFixed(3)),
            minStockQuantity: typeof input?.minStockQuantity === 'undefined' ? undefined : parseStockQuantity(input.minStockQuantity),
            stockUpdatedAt: new Date(),
        },
    });
    return listPriceTables(companyId);
}
async function listOrders(companyId) {
    await ensureSupplierProfile(companyId);
    return { orders: [], paused: true };
}
