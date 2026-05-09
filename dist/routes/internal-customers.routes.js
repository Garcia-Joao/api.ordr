"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalCustomersRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const require_permission_middleware_1 = require("../middleware/require-permission.middleware");
const internal_customers_service_1 = require("../services/internal-customers.service");
exports.internalCustomersRoutes = (0, express_1.Router)();
function getRouteParam(value, paramName) {
    if (!value) {
        throw new Error(`${paramName.toUpperCase()}_REQUIRED`);
    }
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
exports.internalCustomersRoutes.get('/', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('internalCustomers.view', 'interno.view'), async (_req, res) => {
    try {
        const customers = await (0, internal_customers_service_1.listInternalCustomers)();
        return res.json(customers);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            error: error?.message || 'INTERNAL_CUSTOMERS_LIST_ERROR',
        });
    }
});
exports.internalCustomersRoutes.get('/:id/orders/today', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('internalCustomers.view', 'interno.view'), async (req, res) => {
    try {
        const customerId = getRouteParam(req.params.id, 'id');
        const result = await (0, internal_customers_service_1.getInternalCustomerTodayOrders)(customerId);
        return res.json(result);
    }
    catch (error) {
        if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
            return res.status(404).json({
                error: 'INTERNAL_CUSTOMER_NOT_FOUND',
            });
        }
        console.error(error);
        return res.status(500).json({
            error: error?.message || 'INTERNAL_CUSTOMER_TODAY_ERROR',
        });
    }
});
exports.internalCustomersRoutes.get('/:id/orders/pending', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('internalCustomers.view', 'interno.view'), async (req, res) => {
    try {
        const customerId = getRouteParam(req.params.id, 'id');
        const result = await (0, internal_customers_service_1.getInternalCustomerPendingOrders)(customerId);
        return res.json(result);
    }
    catch (error) {
        if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
            return res.status(404).json({
                error: 'INTERNAL_CUSTOMER_NOT_FOUND',
            });
        }
        console.error(error);
        return res.status(500).json({
            error: error?.message || 'INTERNAL_CUSTOMER_PENDING_ERROR',
        });
    }
});
exports.internalCustomersRoutes.post('/:id/orders/pay', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('internalCustomers.pay', 'interno.view'), async (req, res) => {
    try {
        const customerId = getRouteParam(req.params.id, 'id');
        const result = await (0, internal_customers_service_1.paySelectedInternalCustomerOrders)(customerId, req.body);
        return res.json(result);
    }
    catch (error) {
        if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
            return res.status(404).json({
                error: 'INTERNAL_CUSTOMER_NOT_FOUND',
            });
        }
        if (error?.message === 'NO_ORDERS_SELECTED') {
            return res.status(400).json({
                error: 'NO_ORDERS_SELECTED',
            });
        }
        console.error(error);
        return res.status(400).json({
            error: error?.message || 'INTERNAL_CUSTOMER_PAY_ERROR',
        });
    }
});
