"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSuppliersController = listSuppliersController;
exports.getSupplierController = getSupplierController;
exports.createSupplierController = createSupplierController;
exports.updateSupplierController = updateSupplierController;
exports.deleteSupplierController = deleteSupplierController;
exports.createSupplierPriceTableController = createSupplierPriceTableController;
exports.updateSupplierPriceTableController = updateSupplierPriceTableController;
exports.deleteSupplierPriceTableController = deleteSupplierPriceTableController;
exports.createSupplierPriceTableItemController = createSupplierPriceTableItemController;
exports.updateSupplierPriceTableItemController = updateSupplierPriceTableItemController;
exports.deleteSupplierPriceTableItemController = deleteSupplierPriceTableItemController;
const suppliers_service_1 = require("../services/suppliers.service");
function getSingleParam(value, fieldName) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (!normalized || typeof normalized !== 'string')
        throw new Error(`${fieldName}_REQUIRED`);
    return normalized;
}
function getCompanyId(req) {
    const user = req.user;
    const headerCompanyId = req.headers['x-company-id'];
    return user?.companyId ?? user?.company?.id ?? getSingleParam(headerCompanyId, 'COMPANY_ID');
}
function handleError(res, error) {
    const message = error?.message ?? 'INTERNAL_ERROR';
    const status = message.includes('NOT_FOUND')
        ? 404
        : message.includes('REQUIRED') ||
            message.includes('INVALID') ||
            message.includes('ALREADY') ||
            message.includes('key')
            ? 400
            : 500;
    return res.status(status).json({ error: message });
}
async function listSuppliersController(req, res) {
    try {
        return res.json(await (0, suppliers_service_1.listSuppliers)(getCompanyId(req)));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getSupplierController(req, res) {
    try {
        return res.json(await (0, suppliers_service_1.getSupplier)(getCompanyId(req), getSingleParam(req.params.id, 'SUPPLIER_ID')));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createSupplierController(req, res) {
    try {
        return res.status(201).json(await (0, suppliers_service_1.createSupplier)({ companyId: getCompanyId(req), ...req.body }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateSupplierController(req, res) {
    try {
        return res.json(await (0, suppliers_service_1.updateSupplier)({
            companyId: getCompanyId(req),
            supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
            ...req.body,
        }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deleteSupplierController(req, res) {
    try {
        return res.json(await (0, suppliers_service_1.deactivateSupplier)(getCompanyId(req), getSingleParam(req.params.id, 'SUPPLIER_ID')));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createSupplierPriceTableController(req, res) {
    try {
        return res.status(201).json(await (0, suppliers_service_1.createSupplierPriceTable)({
            companyId: getCompanyId(req),
            supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
            ...req.body,
        }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateSupplierPriceTableController(req, res) {
    try {
        return res.json(await (0, suppliers_service_1.updateSupplierPriceTable)({
            companyId: getCompanyId(req),
            supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
            priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
            ...req.body,
        }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deleteSupplierPriceTableController(req, res) {
    try {
        return res.json(await (0, suppliers_service_1.deleteSupplierPriceTable)({
            companyId: getCompanyId(req),
            supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
            priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
        }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createSupplierPriceTableItemController(req, res) {
    try {
        return res.status(201).json(await (0, suppliers_service_1.createSupplierPriceTableItem)({
            companyId: getCompanyId(req),
            supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
            priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
            ...req.body,
        }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateSupplierPriceTableItemController(req, res) {
    try {
        return res.json(await (0, suppliers_service_1.updateSupplierPriceTableItem)({
            companyId: getCompanyId(req),
            supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
            priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
            itemId: getSingleParam(req.params.itemId, 'PRICE_TABLE_ITEM_ID'),
            ...req.body,
        }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deleteSupplierPriceTableItemController(req, res) {
    try {
        return res.json(await (0, suppliers_service_1.deleteSupplierPriceTableItem)({
            companyId: getCompanyId(req),
            supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
            priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
            itemId: getSingleParam(req.params.itemId, 'PRICE_TABLE_ITEM_ID'),
        }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
