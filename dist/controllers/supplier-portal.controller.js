"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = dashboardController;
exports.profileController = profileController;
exports.updateProfileController = updateProfileController;
exports.availabilityController = availabilityController;
exports.productsController = productsController;
exports.ordersController = ordersController;
exports.priceTablesController = priceTablesController;
exports.createPriceTableController = createPriceTableController;
exports.updatePriceTableController = updatePriceTableController;
exports.duplicatePriceTableController = duplicatePriceTableController;
exports.bulkAdjustPriceTablePricesController = bulkAdjustPriceTablePricesController;
exports.createPriceTableItemFromExistingController = createPriceTableItemFromExistingController;
exports.updateItemStockController = updateItemStockController;
exports.togglePriceTableItemActiveController = togglePriceTableItemActiveController;
exports.adjustItemStockController = adjustItemStockController;
exports.deletePriceTableController = deletePriceTableController;
exports.createPriceTableItemController = createPriceTableItemController;
exports.updatePriceTableItemController = updatePriceTableItemController;
exports.deletePriceTableItemController = deletePriceTableItemController;
const supplier_portal_service_1 = require("../services/supplier-portal.service");
function getCompanyId(req) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new Error('COMPANY_ID_REQUIRED');
    return companyId;
}
function getParam(value, field) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (!normalized)
        throw new Error(`${field}_REQUIRED`);
    return normalized;
}
function handleError(res, error) {
    const message = error?.message ?? 'INTERNAL_ERROR';
    const status = message.includes('NOT_FOUND')
        ? 404
        : message.includes('REQUIRED') || message.includes('INVALID') || message.includes('FAILED')
            ? 400
            : message.includes('SUPPLIER_COMPANY_REQUIRED')
                ? 403
                : 500;
    if (status >= 500)
        console.error('[supplier-portal]', error);
    return res.status(status).json({ error: message });
}
async function dashboardController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.getDashboard)(getCompanyId(req)));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function profileController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.getProfile)(getCompanyId(req)));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateProfileController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.updateProfile)(getCompanyId(req), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function availabilityController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.updateAvailability)(getCompanyId(req), Boolean(req.body?.onlineEnabled)));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function productsController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.listProducts)(getCompanyId(req)));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function ordersController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.listOrders)(getCompanyId(req)));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function priceTablesController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.listPriceTables)(getCompanyId(req)));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createPriceTableController(req, res) {
    try {
        return res.status(201).json(await (0, supplier_portal_service_1.createPriceTable)(getCompanyId(req), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updatePriceTableController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.updatePriceTable)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function duplicatePriceTableController(req, res) {
    try {
        return res.status(201).json(await (0, supplier_portal_service_1.duplicatePriceTable)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function bulkAdjustPriceTablePricesController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.bulkAdjustPriceTablePrices)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createPriceTableItemFromExistingController(req, res) {
    try {
        return res.status(201).json(await (0, supplier_portal_service_1.createPriceTableItemFromExisting)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateItemStockController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.updateItemStock)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), getParam(req.params.itemId, 'ITEM_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function togglePriceTableItemActiveController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.togglePriceTableItemActive)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), getParam(req.params.itemId, 'ITEM_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function adjustItemStockController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.adjustItemStock)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), getParam(req.params.itemId, 'ITEM_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deletePriceTableController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.deletePriceTable)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID')));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createPriceTableItemController(req, res) {
    try {
        return res.status(201).json(await (0, supplier_portal_service_1.createPriceTableItem)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updatePriceTableItemController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.updatePriceTableItem)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), getParam(req.params.itemId, 'ITEM_ID'), req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deletePriceTableItemController(req, res) {
    try {
        return res.json(await (0, supplier_portal_service_1.deletePriceTableItem)(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), getParam(req.params.itemId, 'ITEM_ID')));
    }
    catch (error) {
        return handleError(res, error);
    }
}
