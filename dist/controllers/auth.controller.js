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
exports.login = login;
exports.logout = logout;
exports.me = me;
exports.switchCompany = switchCompany;
exports.updateMe = updateMe;
const authService = __importStar(require("../services/auth.service"));
const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7,
};
const COOKIE_NAME = 'auth';
async function login(req, res) {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                error: 'username and password are required',
            });
        }
        const result = await authService.loginUser(username, password);
        res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
        return res.json({
            user: result.user,
        });
    }
    catch (error) {
        if (error?.message === 'INVALID_CREDENTIALS') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (error?.message === 'USER_WITHOUT_COMPANY') {
            return res.status(400).json({ error: 'User is not linked to any company' });
        }
        console.error(error);
        return res.status(500).json({ error: error?.message || 'Failed to login' });
    }
}
async function logout(_req, res) {
    try {
        res.clearCookie(COOKIE_NAME, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
        });
        return res.json({ ok: true });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to logout' });
    }
}
async function me(req, res) {
    return res.json({
        user: req.user,
    });
}
async function switchCompany(req, res) {
    try {
        const userId = req.user?.id;
        const { companyId } = req.body;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' });
        }
        const result = await authService.switchUserCompany(userId, companyId);
        res.cookie(COOKIE_NAME, result.token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 7,
        });
        return res.json({
            user: result.user,
        });
    }
    catch (error) {
        if (error?.message === 'COMPANY_ACCESS_DENIED') {
            return res.status(403).json({ error: 'Access denied to this company' });
        }
        console.error(error);
        return res.status(500).json({ error: error?.message || 'Failed to switch company' });
    }
}
async function updateMe(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { name, username, phone, photoBase64, currentPassword, newPassword } = req.body;
        const updatedUser = await authService.updateMyAccount({
            userId,
            name,
            username,
            phone,
            photoBase64,
            currentPassword,
            newPassword,
        });
        return res.json({
            user: updatedUser,
        });
    }
    catch (error) {
        console.error('updateMe error:', error);
        if (error?.message === 'USER_NOT_FOUND') {
            return res.status(404).json({ error: 'User not found' });
        }
        if (error?.message === 'USERNAME_ALREADY_EXISTS') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        if (error?.message === 'USER_WITHOUT_COMPANY') {
            return res.status(400).json({ error: 'User is not linked to any company' });
        }
        if (error?.message === 'PHOTO_TOO_LARGE') {
            return res.status(400).json({ error: 'Photo is too large' });
        }
        if (error?.message === 'USERNAME_REQUIRED') {
            return res.status(400).json({ error: 'Username is required' });
        }
        if (error?.message === 'CURRENT_PASSWORD_REQUIRED') {
            return res.status(400).json({ error: 'Current password is required' });
        }
        if (error?.message === 'INVALID_CURRENT_PASSWORD') {
            return res.status(400).json({ error: 'Current password is invalid' });
        }
        if (error?.message === 'NEW_PASSWORD_REQUIRED') {
            return res.status(400).json({ error: 'New password is required' });
        }
        if (error?.message === 'PASSWORD_TOO_SHORT') {
            return res.status(400).json({ error: 'New password is too short' });
        }
        return res.status(500).json({
            error: error?.message || 'Failed to update account',
        });
    }
}
