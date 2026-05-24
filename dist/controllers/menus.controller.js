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
exports.listMenus = listMenus;
exports.getActiveMenu = getActiveMenu;
exports.getMenu = getMenu;
exports.createMenu = createMenu;
exports.updateMenu = updateMenu;
exports.activateMenu = activateMenu;
exports.deleteMenu = deleteMenu;
const menusService = __importStar(require("../services/menus.service"));
function param(value) {
    return Array.isArray(value) ? value[0] : value || '';
}
function handleError(res, error) {
    const message = error?.message || 'Erro no cardápio.';
    if (message === 'MENU_NOT_FOUND')
        return res.status(404).json({ error: message });
    if ([
        'MENU_NAME_REQUIRED',
        'MENU_PRODUCT_NOT_FOUND',
        'ACTIVE_MENU_CANNOT_BE_DELETED',
    ].includes(message))
        return res.status(400).json({ error: message });
    if (error?.code === 'P2002')
        return res.status(400).json({ error: 'MENU_DUPLICATED' });
    return res.status(500).json({ error: message });
}
async function listMenus(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        return res.json({ menus: await menusService.listMenus(companyId) });
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getActiveMenu(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        return res.json({ menu: await menusService.getActiveMenu(companyId) });
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getMenu(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        return res.json({ menu: await menusService.getMenu(companyId, param(req.params.id)) });
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createMenu(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        return res.status(201).json({ menu: await menusService.createMenu(companyId, req.body) });
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateMenu(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        return res.json({ menu: await menusService.updateMenu(companyId, param(req.params.id), req.body) });
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function activateMenu(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        return res.json({ menu: await menusService.activateMenu(companyId, param(req.params.id)) });
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deleteMenu(req, res) {
    try {
        const companyId = req.user?.companyId;
        if (!companyId)
            return res.status(401).json({ error: 'Unauthorized' });
        return res.json(await menusService.deleteMenu(companyId, param(req.params.id)));
    }
    catch (error) {
        return handleError(res, error);
    }
}
