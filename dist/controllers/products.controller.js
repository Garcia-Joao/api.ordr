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
exports.getProducts = getProducts;
exports.getProductById = getProductById;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
const productsService = __importStar(require("../services/products.service"));
async function getProducts(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const includeInactive = req.query.includeInactive === 'true';
        const menu = req.query.menu === 'active' ? 'active' : 'all';
        const products = await productsService.getProductsByCompany(companyId, includeInactive, { menu });
        return res.json(products);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: error?.message || 'Failed to fetch products' });
    }
}
async function getProductById(req, res) {
    try {
        const companyId = req.user?.companyId;
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const product = await productsService.getProductById(id, companyId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.json(product);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: error?.message || 'Failed to fetch product' });
    }
}
async function createProduct(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const product = await productsService.createProduct({
            companyId,
            ...req.body,
        }, userId);
        return res.status(201).json(product);
    }
    catch (error) {
        console.error('createProduct error:', error);
        switch (error?.message) {
            case 'CATEGORY_NOT_FOUND':
                return res.status(400).json({ error: 'Category not found' });
            case 'CATEGORY_REQUIRED':
                return res.status(400).json({ error: 'Category is required' });
            case 'RECIPE_INGREDIENT_REQUIRED':
                return res.status(400).json({ error: 'Recipe ingredient is required' });
            case 'RECIPE_INGREDIENT_NOT_FOUND':
                return res.status(400).json({ error: 'Recipe ingredient not found' });
            case 'RECIPE_INGREDIENT_CANNOT_BE_SELF':
                return res.status(400).json({ error: 'A product cannot use itself as ingredient' });
            case 'RECIPE_CYCLE_DETECTED':
                return res.status(400).json({ error: 'Recipe cycle detected' });
            case 'RECIPE_ITEMS_REQUIRED':
                return res.status(400).json({ error: 'Recipe items are required' });
            case 'RECIPE_OUTPUT_QUANTITY_REQUIRED':
                return res.status(400).json({ error: 'Recipe output quantity is required' });
            case 'RECIPE_OUTPUT_UNIT_REQUIRED':
                return res.status(400).json({ error: 'Recipe output unit is required' });
            default:
                if (error?.code === 'P2002') {
                    return res.status(400).json({
                        error: 'A product with this name already exists in this company',
                    });
                }
                return res.status(500).json({
                    error: error?.message || 'Failed to create product',
                });
        }
    }
}
async function updateProduct(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const product = await productsService.updateProduct(id, companyId, req.body, userId);
        return res.json(product);
    }
    catch (error) {
        console.error(error);
        switch (error?.message) {
            case 'PRODUCT_NOT_FOUND':
                return res.status(404).json({ error: 'Product not found' });
            case 'CATEGORY_NOT_FOUND':
                return res.status(400).json({ error: 'Category not found' });
            case 'CATEGORY_REQUIRED':
                return res.status(400).json({ error: 'Category is required' });
            case 'RECIPE_INGREDIENT_REQUIRED':
                return res.status(400).json({ error: 'Recipe ingredient is required' });
            case 'RECIPE_INGREDIENT_NOT_FOUND':
                return res.status(400).json({ error: 'Recipe ingredient not found' });
            case 'RECIPE_INGREDIENT_CANNOT_BE_SELF':
                return res.status(400).json({ error: 'A product cannot use itself as ingredient' });
            case 'RECIPE_CYCLE_DETECTED':
                return res.status(400).json({ error: 'Recipe cycle detected' });
            case 'RECIPE_ITEMS_REQUIRED':
                return res.status(400).json({ error: 'Recipe items are required' });
            case 'RECIPE_OUTPUT_QUANTITY_REQUIRED':
                return res.status(400).json({ error: 'Recipe output quantity is required' });
            case 'RECIPE_OUTPUT_UNIT_REQUIRED':
                return res.status(400).json({ error: 'Recipe output unit is required' });
            default:
                return res.status(500).json({ error: error?.message || 'Failed to update product' });
        }
    }
}
async function deleteProduct(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await productsService.deleteProduct(id, companyId, userId);
        return res.json({ ok: true });
    }
    catch (error) {
        console.error('deleteProduct error:', error);
        if (error?.message === 'PRODUCT_NOT_FOUND') {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to delete product',
        });
    }
}
