"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBuyCartController = getBuyCartController;
exports.updateBuyCartController = updateBuyCartController;
exports.upsertBuyCartItemController = upsertBuyCartItemController;
exports.removeBuyCartItemController = removeBuyCartItemController;
exports.clearBuyCartController = clearBuyCartController;
exports.confirmBuyCartController = confirmBuyCartController;
exports.listBuyRequestsController = listBuyRequestsController;
exports.getBuyRequestController = getBuyRequestController;
exports.createBuyRequestController = createBuyRequestController;
exports.receiveBuyRequestController = receiveBuyRequestController;
exports.printBuyRequestShoppingListController = printBuyRequestShoppingListController;
exports.cancelBuyRequestController = cancelBuyRequestController;
const buys_service_1 = require("../services/buys.service");
function getSingleParam(value, fieldName) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (!normalized || typeof normalized !== 'string') {
        throw new Error(`${fieldName}_REQUIRED`);
    }
    return normalized;
}
function getCompanyId(req) {
    const user = req.user;
    const headerCompanyId = req.headers['x-company-id'];
    const companyId = user?.companyId ??
        user?.company?.id ??
        getSingleParam(headerCompanyId, 'COMPANY_ID');
    return companyId;
}
function handleError(res, error) {
    const message = error?.message ?? 'INTERNAL_ERROR';
    const status = message.includes('NOT_FOUND')
        ? 404
        : message.includes('REQUIRED') ||
            message.includes('INVALID') ||
            message.includes('EMPTY') ||
            message.includes('ALREADY') ||
            message.includes('CANCELLED')
            ? 400
            : 500;
    return res.status(status).json({ error: message });
}
async function getBuyCartController(req, res) {
    try {
        const companyId = getCompanyId(req);
        return res.json(await (0, buys_service_1.getBuyCart)(companyId));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateBuyCartController(req, res) {
    try {
        const companyId = getCompanyId(req);
        return res.json(await (0, buys_service_1.updateBuyCart)(companyId, req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function upsertBuyCartItemController(req, res) {
    try {
        const companyId = getCompanyId(req);
        return res.json(await (0, buys_service_1.addOrUpdateBuyCartItem)(companyId, req.body));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function removeBuyCartItemController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const productId = getSingleParam(req.params.productId, 'PRODUCT_ID');
        return res.json(await (0, buys_service_1.removeBuyCartItem)(companyId, productId));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function clearBuyCartController(req, res) {
    try {
        const companyId = getCompanyId(req);
        return res.json(await (0, buys_service_1.clearBuyCart)(companyId));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function confirmBuyCartController(req, res) {
    try {
        const companyId = getCompanyId(req);
        return res.status(201).json(await (0, buys_service_1.confirmBuyCart)({ companyId, ...req.body }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function listBuyRequestsController(req, res) {
    try {
        const companyId = getCompanyId(req);
        return res.json(await (0, buys_service_1.listBuyRequests)(companyId));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getBuyRequestController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const id = getSingleParam(req.params.id, 'BUY_REQUEST_ID');
        return res.json(await (0, buys_service_1.getBuyRequest)(companyId, id));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createBuyRequestController(req, res) {
    try {
        const companyId = getCompanyId(req);
        return res.status(201).json(await (0, buys_service_1.createBuyRequest)({ companyId, ...req.body }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function receiveBuyRequestController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const buyRequestId = getSingleParam(req.params.id, 'BUY_REQUEST_ID');
        return res.json(await (0, buys_service_1.receiveBuyRequest)({
            companyId,
            buyRequestId,
            items: req.body.items ?? [],
        }));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function printBuyRequestShoppingListController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const id = getSingleParam(req.params.id, 'BUY_REQUEST_ID');
        return res.json(await (0, buys_service_1.printBuyRequestShoppingList)(companyId, id, typeof req.body?.portId === 'string' ? req.body.portId : null));
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function cancelBuyRequestController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const id = getSingleParam(req.params.id, 'BUY_REQUEST_ID');
        return res.json(await (0, buys_service_1.cancelBuyRequest)(companyId, id));
    }
    catch (error) {
        return handleError(res, error);
    }
}
