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
exports.getInternalCustomers = getInternalCustomers;
exports.getInternalCustomerTodayOrders = getInternalCustomerTodayOrders;
exports.getInternalCustomerPendingOrders = getInternalCustomerPendingOrders;
exports.paySelectedInternalCustomerOrders = paySelectedInternalCustomerOrders;
const internalCustomersService = __importStar(require("../services/internal-customers.service"));
function getParam(value, name) {
    if (!value) {
        throw new Error(`${name.toUpperCase()}_REQUIRED`);
    }
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
function getErrorMessage(error, fallback) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}
async function getInternalCustomers(_req, res) {
    try {
        const customers = await internalCustomersService.listInternalCustomers();
        return res.json(customers);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            error: getErrorMessage(error, 'INTERNAL_CUSTOMERS_LIST_ERROR'),
        });
    }
}
async function getInternalCustomerTodayOrders(req, res) {
    try {
        const customerId = getParam(req.params.id, 'id');
        const result = await internalCustomersService.getInternalCustomerTodayOrders(customerId);
        return res.json(result);
    }
    catch (error) {
        const message = getErrorMessage(error, 'INTERNAL_CUSTOMER_TODAY_ORDERS_ERROR');
        if (message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
            return res.status(404).json({ error: message });
        }
        console.error(error);
        return res.status(400).json({
            error: message,
        });
    }
}
async function getInternalCustomerPendingOrders(req, res) {
    try {
        const customerId = getParam(req.params.id, 'id');
        const result = await internalCustomersService.getInternalCustomerPendingOrders(customerId);
        return res.json(result);
    }
    catch (error) {
        const message = getErrorMessage(error, 'INTERNAL_CUSTOMER_PENDING_ORDERS_ERROR');
        if (message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
            return res.status(404).json({ error: message });
        }
        console.error(error);
        return res.status(400).json({
            error: message,
        });
    }
}
async function paySelectedInternalCustomerOrders(req, res) {
    try {
        const customerId = getParam(req.params.id, 'id');
        const result = await internalCustomersService.paySelectedInternalCustomerOrders(customerId, req.body);
        return res.json(result);
    }
    catch (error) {
        const message = getErrorMessage(error, 'INTERNAL_CUSTOMER_PAYMENT_ERROR');
        if (message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
            return res.status(404).json({ error: message });
        }
        if (message === 'NO_ORDERS_SELECTED') {
            return res.status(400).json({ error: message });
        }
        console.error(error);
        return res.status(400).json({
            error: message,
        });
    }
}
