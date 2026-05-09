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
exports.getCategories = getCategories;
exports.getCategoryById = getCategoryById;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
const categoriesService = __importStar(require("../services/categories.service"));
function getSingleParam(value) {
    if (!value)
        return '';
    return Array.isArray(value) ? value[0] : value;
}
async function getCategories(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const categories = await categoriesService.getCategoriesByCompany(companyId);
        return res.json(categories);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to fetch categories' });
    }
}
async function getCategoryById(req, res) {
    try {
        const companyId = req.user?.companyId;
        const id = getSingleParam(req.params.id);
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const category = await categoriesService.getCategoryById(id, companyId);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        return res.json(category);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to fetch category' });
    }
}
async function createCategory(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const category = await categoriesService.createCategory({
            companyId,
            ...req.body,
        }, userId);
        return res.status(201).json(category);
    }
    catch (error) {
        console.error('createCategory error:', error);
        if (error?.message === 'CATEGORY_NAME_REQUIRED') {
            return res.status(400).json({ error: 'Category name is required' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to create category',
        });
    }
}
async function updateCategory(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const id = getSingleParam(req.params.id);
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const category = await categoriesService.updateCategory(id, companyId, req.body, userId);
        return res.json(category);
    }
    catch (error) {
        console.error(error);
        if (error?.message === 'CATEGORY_NOT_FOUND') {
            return res.status(404).json({ error: 'Category not found' });
        }
        if (error?.message === 'CATEGORY_NAME_REQUIRED') {
            return res.status(400).json({ error: 'Category name is required' });
        }
        return res.status(500).json({ error: 'Failed to update category' });
    }
}
async function deleteCategory(req, res) {
    try {
        const companyId = req.user?.companyId;
        const userId = req.user?.id;
        const id = getSingleParam(req.params.id);
        if (!companyId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await categoriesService.deleteCategory(id, companyId, userId);
        return res.json({ ok: true });
    }
    catch (error) {
        console.error(error);
        if (error?.message === 'CATEGORY_NOT_FOUND') {
            return res.status(404).json({ error: 'Category not found' });
        }
        if (error?.message === 'CATEGORY_HAS_PRODUCTS') {
            return res.status(400).json({ error: 'Category has products linked to it' });
        }
        return res.status(500).json({ error: 'Failed to delete category' });
    }
}
