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
exports.getStockProducts = getStockProducts;
exports.createStockMovement = createStockMovement;
exports.getProductStockMovements = getProductStockMovements;
exports.getRecipeAnalysis = getRecipeAnalysis;
exports.calculateRecipeProduction = calculateRecipeProduction;
const stockService = __importStar(require("../services/stock.service"));
async function getStockProducts(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const products = await stockService.getStockProducts(companyId);
        return res.json(products);
    }
    catch (error) {
        console.error('getStockProducts error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to fetch stock products',
        });
    }
}
async function createStockMovement(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { productId, type, quantity, reason } = req.body;
        const movement = await stockService.createStockMovement({
            companyId,
            productId: productId ?? '',
            type: type,
            quantity: Number(quantity ?? 0),
            reason: reason ?? null,
        });
        return res.status(201).json(movement);
    }
    catch (error) {
        console.error('createStockMovement error:', error);
        switch (error?.message) {
            case 'PRODUCT_NOT_FOUND':
                return res.status(404).json({ error: 'Product not found' });
            case 'STOCK_MOVEMENT_TYPE_REQUIRED':
                return res.status(400).json({ error: 'Movement type is required' });
            case 'STOCK_MOVEMENT_QUANTITY_INVALID':
                return res.status(400).json({ error: 'Quantity must be greater than zero' });
            default:
                return res.status(500).json({
                    error: error?.message || 'Failed to create stock movement',
                });
        }
    }
}
async function getProductStockMovements(req, res) {
    try {
        const companyId = req.user?.companyId;
        const productId = Array.isArray(req.params.productId)
            ? req.params.productId[0]
            : req.params.productId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const movements = await stockService.getProductStockMovements(companyId, productId);
        return res.json(movements);
    }
    catch (error) {
        console.error('getProductStockMovements error:', error);
        if (error?.message === 'PRODUCT_NOT_FOUND') {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to fetch stock movements',
        });
    }
}
async function getRecipeAnalysis(req, res) {
    try {
        const companyId = req.user?.companyId;
        const productId = Array.isArray(req.params.productId)
            ? req.params.productId[0]
            : req.params.productId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const analysis = await stockService.getRecipeAnalysis(companyId, productId);
        return res.json(analysis);
    }
    catch (error) {
        console.error('getRecipeAnalysis error:', error);
        switch (error?.message) {
            case 'PRODUCT_NOT_FOUND':
                return res.status(404).json({ error: 'Product not found' });
            case 'PRODUCT_IS_NOT_RECIPE':
                return res.status(400).json({ error: 'Product is not a recipe' });
            case 'RECIPE_CYCLE_DETECTED':
                return res.status(400).json({ error: 'Recipe cycle detected' });
            case 'RECIPE_UNIT_MISMATCH':
                return res.status(400).json({ error: 'Recipe unit mismatch' });
            case 'RECIPE_MAX_DEPTH_EXCEEDED':
                return res.status(400).json({ error: 'Recipe nesting too deep' });
            case 'RECIPE_OUTPUT_QUANTITY_REQUIRED':
                return res.status(400).json({ error: 'Recipe output quantity is required' });
            default:
                return res.status(500).json({
                    error: error?.message || 'Failed to analyze recipe',
                });
        }
    }
}
async function calculateRecipeProduction(req, res) {
    try {
        const companyId = req.user?.companyId;
        const productId = Array.isArray(req.params.productId)
            ? req.params.productId[0]
            : req.params.productId;
        const quantity = Number(req.query.quantity ?? 0);
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await stockService.calculateRecipeProduction(companyId, productId, quantity);
        return res.json(result);
    }
    catch (error) {
        console.error('calculateRecipeProduction error:', error);
        switch (error?.message) {
            case 'PRODUCT_NOT_FOUND':
                return res.status(404).json({ error: 'Product not found' });
            case 'PRODUCT_IS_NOT_RECIPE':
                return res.status(400).json({ error: 'Product is not a recipe' });
            case 'RECIPE_CYCLE_DETECTED':
                return res.status(400).json({ error: 'Recipe cycle detected' });
            case 'RECIPE_UNIT_MISMATCH':
                return res.status(400).json({ error: 'Recipe unit mismatch' });
            case 'RECIPE_MAX_DEPTH_EXCEEDED':
                return res.status(400).json({ error: 'Recipe nesting too deep' });
            case 'RECIPE_OUTPUT_QUANTITY_REQUIRED':
                return res.status(400).json({ error: 'Recipe output quantity is required' });
            case 'CALCULATOR_QUANTITY_INVALID':
                return res.status(400).json({ error: 'Invalid quantity' });
            default:
                return res.status(500).json({
                    error: error?.message || 'Failed to calculate production',
                });
        }
    }
}
