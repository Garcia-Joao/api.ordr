"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomersController = listCustomersController;
exports.getCustomerController = getCustomerController;
exports.createCustomerController = createCustomerController;
exports.updateCustomerController = updateCustomerController;
exports.deleteCustomerController = deleteCustomerController;
exports.upsertEventCustomerComandaController = upsertEventCustomerComandaController;
exports.removeEventCustomerComandaController = removeEventCustomerComandaController;
exports.lookupCustomerByEventComandaController = lookupCustomerByEventComandaController;
const customers_service_1 = require("../services/customers.service");
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
        (Array.isArray(headerCompanyId) ? headerCompanyId[0] : headerCompanyId);
    if (!companyId || typeof companyId !== 'string') {
        throw new Error('COMPANY_ID_REQUIRED');
    }
    return companyId;
}
function handleError(res, error) {
    const message = error?.message ?? 'INTERNAL_ERROR';
    const status = message.includes('NOT_FOUND')
        ? 404
        : message.includes('REQUIRED') ||
            message.includes('INVALID') ||
            message.includes('ALREADY_LINKED')
            ? 400
            : 500;
    return res.status(status).json({ error: message });
}
async function listCustomersController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const includeInactive = req.query.includeInactive === 'true';
        const customers = await (0, customers_service_1.listCustomers)({
            companyId,
            search,
            includeInactive,
        });
        return res.json(customers);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getCustomerController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const customerId = getSingleParam(req.params.id, 'CUSTOMER_ID');
        const customer = await (0, customers_service_1.getCustomer)(companyId, customerId);
        return res.json(customer);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createCustomerController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const customer = await (0, customers_service_1.createCustomer)({
            companyId,
            name: req.body.name,
            phone: req.body.phone ?? null,
            email: req.body.email ?? null,
        });
        return res.status(201).json(customer);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateCustomerController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const customerId = getSingleParam(req.params.id, 'CUSTOMER_ID');
        const customer = await (0, customers_service_1.updateCustomer)(companyId, customerId, req.body);
        return res.json(customer);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deleteCustomerController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const customerId = getSingleParam(req.params.id, 'CUSTOMER_ID');
        const customer = await (0, customers_service_1.deactivateCustomer)(companyId, customerId);
        return res.json(customer);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function upsertEventCustomerComandaController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const link = await (0, customers_service_1.upsertEventCustomerComanda)({
            companyId,
            eventDateId: req.body.eventDateId,
            customerId: req.body.customerId,
            comandaNumber: Number(req.body.comandaNumber),
            comandaName: req.body.comandaName ?? null,
        });
        return res.json(link);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function removeEventCustomerComandaController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = getSingleParam(req.params.eventDateId, 'EVENT_DATE_ID');
        const customerId = getSingleParam(req.params.customerId, 'CUSTOMER_ID');
        const result = await (0, customers_service_1.removeEventCustomerComanda)({
            companyId,
            eventDateId,
            customerId,
        });
        return res.json(result);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function lookupCustomerByEventComandaController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = typeof req.query.eventDateId === 'string' ? req.query.eventDateId : null;
        const comandaNumber = typeof req.query.comandaNumber === 'string'
            ? Number(req.query.comandaNumber)
            : null;
        if (!eventDateId)
            throw new Error('EVENT_DATE_ID_REQUIRED');
        if (!comandaNumber)
            throw new Error('COMANDA_NUMBER_REQUIRED');
        const result = await (0, customers_service_1.lookupCustomerByEventComanda)({
            companyId,
            eventDateId,
            comandaNumber,
        });
        return res.json(result);
    }
    catch (error) {
        return handleError(res, error);
    }
}
