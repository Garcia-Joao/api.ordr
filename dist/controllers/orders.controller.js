"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrders = getOrders;
exports.createOrder = createOrder;
exports.cancelOrder = cancelOrder;
exports.getInternalCustomerTodayOrders = getInternalCustomerTodayOrders;
exports.payInternalCustomerTodayOrders = payInternalCustomerTodayOrders;
exports.downloadOrdersReportPdf = downloadOrdersReportPdf;
exports.getOrdersReportSummary = getOrdersReportSummary;
exports.paySelectedInternalCustomerOrders = paySelectedInternalCustomerOrders;
exports.getInternalCustomerPendingOrders = getInternalCustomerPendingOrders;
const orderService = __importStar(require("../services/orders.service"));
function getHeaderString(value) {
    if (Array.isArray(value))
        return value[0];
    return value;
}
async function getOrders(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const includeCancelled = req.query.includeCancelled === 'true';
        const orders = await orderService.getOrdersByCompany(companyId, includeCancelled);
        return res.json(orders);
    }
    catch (error) {
        console.error('getOrders error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to fetch orders',
        });
    }
}
async function createOrder(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const order = await orderService.createOrder({
            companyId,
            ...req.body,
            deviceId: getHeaderString(req.headers['x-device-id']) ?? req.body?.deviceId ?? null,
        }, userId);
        return res.status(201).json(order);
    }
    catch (error) {
        console.error('createOrder error:', error);
        switch (error?.message) {
            case 'ORDER_COMPANY_ID_REQUIRED':
                return res.status(400).json({ error: 'Company ID is required' });
            case 'INTERNAL_CUSTOMER_DISABLED':
                return res.status(400).json({ error: 'INTERNAL_CUSTOMER_DISABLED' });
            case 'ORDER_COMANDA_REQUIRED':
                return res.status(400).json({ error: 'Comanda is required' });
            case 'ORDER_ITEMS_REQUIRED':
                return res.status(400).json({ error: 'Order items are required' });
            case 'ORDER_PAYMENT_METHOD_REQUIRED':
                return res.status(400).json({ error: 'Payment method is required' });
            case 'INTERNAL_CUSTOMER_NOT_FOUND':
                return res.status(404).json({ error: 'Internal customer not found' });
            default:
                return res.status(500).json({
                    error: error?.message || 'Failed to create order',
                });
        }
    }
}
async function cancelOrder(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const order = await orderService.cancelOrder(id, companyId, userId);
        return res.json(order);
    }
    catch (error) {
        console.error('cancelOrder error:', error);
        if (error?.message === 'ORDER_NOT_FOUND') {
            return res.status(404).json({ error: 'Order not found' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to cancel order',
        });
    }
}
async function getInternalCustomerTodayOrders(req, res) {
    try {
        const companyId = req.user?.companyId;
        const internalCustomerId = Array.isArray(req.params.internalCustomerId)
            ? req.params.internalCustomerId[0]
            : req.params.internalCustomerId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await orderService.getInternalCustomerTodayOrders(companyId, internalCustomerId);
        return res.json(result);
    }
    catch (error) {
        console.error('getInternalCustomerTodayOrders error:', error);
        if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
            return res.status(404).json({ error: 'Internal customer not found' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to load internal customer orders',
        });
    }
}
async function payInternalCustomerTodayOrders(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const internalCustomerId = Array.isArray(req.params.internalCustomerId)
            ? req.params.internalCustomerId[0]
            : req.params.internalCustomerId;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { paymentMethod, taxApplied } = req.body;
        const result = await orderService.payInternalCustomerTodayOrders({
            companyId,
            internalCustomerId,
            paymentMethod: paymentMethod,
            taxApplied: Boolean(taxApplied),
            userId,
        });
        return res.json(result);
    }
    catch (error) {
        console.error('payInternalCustomerTodayOrders error:', error);
        switch (error?.message) {
            case 'ORDER_PAYMENT_METHOD_REQUIRED':
                return res.status(400).json({ error: 'Payment method is required' });
            case 'INTERNAL_CUSTOMER_NOT_FOUND':
                return res.status(404).json({ error: 'Internal customer not found' });
            default:
                return res.status(500).json({
                    error: error?.message || 'Failed to pay internal customer orders',
                });
        }
    }
}
async function downloadOrdersReportPdf(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const buffer = await orderService.generateOrdersReportPdf(companyId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="orders-report.pdf"');
        return res.send(buffer);
    }
    catch (error) {
        console.error('downloadOrdersReportPdf error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to generate orders report PDF',
        });
    }
}
async function getOrdersReportSummary(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const fromDate = typeof req.query.fromDate === 'string' && req.query.fromDate.trim()
            ? req.query.fromDate.trim()
            : undefined;
        const toDate = typeof req.query.toDate === 'string' && req.query.toDate.trim()
            ? req.query.toDate.trim()
            : undefined;
        const summary = await orderService.getOrdersReportSummary(companyId, fromDate, toDate);
        return res.json(summary);
    }
    catch (error) {
        console.error('getOrdersReportSummary error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to load report summary',
        });
    }
}
async function paySelectedInternalCustomerOrders(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const internalCustomerId = Array.isArray(req.params.internalCustomerId)
            ? req.params.internalCustomerId[0]
            : req.params.internalCustomerId;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { paymentMethod, taxApplied, orderIds } = req.body;
        const result = await orderService.paySelectedInternalCustomerOrders({
            companyId,
            internalCustomerId,
            paymentMethod: paymentMethod,
            taxApplied: Boolean(taxApplied),
            orderIds: Array.isArray(orderIds) ? orderIds : [],
            userId,
        });
        return res.json(result);
    }
    catch (error) {
        console.error('paySelectedInternalCustomerOrders error:', error);
        switch (error?.message) {
            case 'ORDER_PAYMENT_METHOD_REQUIRED':
                return res.status(400).json({ error: 'Payment method is required' });
            case 'ORDER_IDS_REQUIRED':
                return res.status(400).json({ error: 'Order IDs are required' });
            case 'INTERNAL_CUSTOMER_NOT_FOUND':
                return res.status(404).json({ error: 'Internal customer not found' });
            default:
                return res.status(500).json({
                    error: error?.message || 'Failed to pay selected internal customer orders',
                });
        }
    }
}
async function getInternalCustomerPendingOrders(req, res) {
    try {
        const companyId = req.user?.companyId;
        const internalCustomerId = Array.isArray(req.params.internalCustomerId)
            ? req.params.internalCustomerId[0]
            : req.params.internalCustomerId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await orderService.getInternalCustomerPendingOrders(companyId, internalCustomerId);
        return res.json(result);
    }
    catch (error) {
        console.error('getInternalCustomerPendingOrders error:', error);
        if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
            return res.status(404).json({ error: 'Internal customer not found' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to load internal customer pending orders',
        });
    }
}
