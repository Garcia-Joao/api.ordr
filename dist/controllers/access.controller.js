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
exports.getPermissionCatalog = getPermissionCatalog;
exports.getRoles = getRoles;
exports.createRole = createRole;
exports.updateRole = updateRole;
exports.deleteRole = deleteRole;
exports.getCompanyUsers = getCompanyUsers;
exports.createCompanyUser = createCompanyUser;
exports.updateCompanyUser = updateCompanyUser;
exports.updateMembershipAccess = updateMembershipAccess;
exports.getAssignableEventDates = getAssignableEventDates;
exports.updateMyActiveEventDate = updateMyActiveEventDate;
const accessService = __importStar(require("../services/access.service"));
function getCompanyId(req) {
    const headerCompanyId = req.headers['x-company-id'];
    if (Array.isArray(headerCompanyId))
        return headerCompanyId[0] || req.user?.companyId;
    return headerCompanyId || req.user?.companyId;
}
function getParamString(value) {
    if (Array.isArray(value))
        return value[0] ?? '';
    return value ?? '';
}
function handleAccessError(res, error, fallback) {
    if (error?.message === 'ROLE_NAME_REQUIRED')
        return res.status(400).json({ error: 'Informe o nome do cargo.' });
    if (error?.message === 'ROLE_NOT_FOUND')
        return res.status(404).json({ error: 'Cargo não encontrado.' });
    if (error?.message === 'USERNAME_REQUIRED')
        return res.status(400).json({ error: 'Informe o nome de usuário.' });
    if (error?.message === 'USERNAME_TOO_SHORT')
        return res.status(400).json({ error: 'O usuário deve ter pelo menos 3 caracteres.' });
    if (error?.message === 'PASSWORD_REQUIRED')
        return res.status(400).json({ error: 'Informe a senha.' });
    if (error?.message === 'PASSWORD_TOO_SHORT')
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    if (error?.message === 'USERNAME_ALREADY_EXISTS')
        return res.status(409).json({ error: 'Já existe um usuário com este login.' });
    if (error?.message === 'CUSTOM_ROLE_REQUIRED')
        return res.status(400).json({ error: 'Selecione um cargo para acesso customizado.' });
    if (error?.message === 'MEMBERSHIP_NOT_FOUND')
        return res.status(404).json({ error: 'Usuário não encontrado nesta empresa.' });
    if (error?.message === 'EVENT_DATE_NOT_FOUND')
        return res.status(404).json({ error: 'Evento não encontrado para esta empresa.' });
    if (error?.message === 'LAST_ADMIN_CANNOT_BE_CHANGED')
        return res.status(400).json({ error: 'Você precisa manter pelo menos um administrador na empresa.' });
    if (String(error?.message || '').includes('Unique constraint'))
        return res.status(409).json({ error: 'Já existe um registro com estes dados.' });
    return res.status(500).json({ error: error?.message || fallback });
}
function getPermissionCatalog(_req, res) {
    return res.json({ groups: accessService.getPermissionCatalog() });
}
async function getRoles(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const roles = await accessService.listRoles(companyId);
        return res.json({ roles });
    }
    catch (error) {
        console.error('getRoles error:', error);
        return handleAccessError(res, error, 'Erro ao listar cargos');
    }
}
async function createRole(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const role = await accessService.createRole({
            companyId,
            userId: req.user?.id ?? null,
            name: req.body?.name,
            description: req.body?.description,
            permissionKeys: req.body?.permissionKeys ?? [],
        });
        return res.status(201).json({ role });
    }
    catch (error) {
        console.error('createRole error:', error);
        return handleAccessError(res, error, 'Erro ao criar cargo');
    }
}
async function updateRole(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const roleId = getParamString(req.params.id);
        if (!roleId)
            return res.status(400).json({ error: 'roleId is required' });
        const role = await accessService.updateRole({
            companyId,
            userId: req.user?.id ?? null,
            roleId,
            name: req.body?.name,
            description: req.body?.description,
            active: req.body?.active,
            permissionKeys: req.body?.permissionKeys,
        });
        return res.json({ role });
    }
    catch (error) {
        console.error('updateRole error:', error);
        return handleAccessError(res, error, 'Erro ao atualizar cargo');
    }
}
async function deleteRole(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const roleId = getParamString(req.params.id);
        if (!roleId)
            return res.status(400).json({ error: 'roleId is required' });
        const result = await accessService.deleteRole({ companyId, userId: req.user?.id ?? null, roleId });
        return res.json(result);
    }
    catch (error) {
        console.error('deleteRole error:', error);
        return handleAccessError(res, error, 'Erro ao excluir cargo');
    }
}
async function getCompanyUsers(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const users = await accessService.listCompanyUsers(companyId);
        return res.json({ users });
    }
    catch (error) {
        console.error('getCompanyUsers error:', error);
        return handleAccessError(res, error, 'Erro ao listar usuários');
    }
}
async function createCompanyUser(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const systemRole = req.body?.systemRole;
        if (systemRole !== 'ADMIN' && systemRole !== 'CUSTOM')
            return res.status(400).json({ error: 'Tipo de acesso inválido.' });
        const membership = await accessService.createCompanyUser({
            companyId,
            actorUserId: req.user?.id ?? null,
            username: req.body?.username,
            password: req.body?.password,
            name: req.body?.name,
            phone: req.body?.phone,
            systemRole,
            customRoleId: req.body?.customRoleId ?? null,
            activeEventDateId: req.body?.activeEventDateId ?? null,
        });
        return res.status(201).json({ user: membership });
    }
    catch (error) {
        console.error('createCompanyUser error:', error);
        return handleAccessError(res, error, 'Erro ao criar usuário');
    }
}
async function updateCompanyUser(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const membershipId = getParamString(req.params.id);
        if (!membershipId)
            return res.status(400).json({ error: 'membershipId is required' });
        const systemRole = req.body?.systemRole;
        if (systemRole !== 'ADMIN' && systemRole !== 'CUSTOM')
            return res.status(400).json({ error: 'Tipo de acesso inválido.' });
        const membership = await accessService.updateCompanyUser({
            companyId,
            actorUserId: req.user?.id ?? null,
            membershipId,
            username: req.body?.username,
            password: req.body?.password,
            name: req.body?.name,
            phone: req.body?.phone,
            systemRole,
            customRoleId: req.body?.customRoleId ?? null,
            activeEventDateId: req.body?.activeEventDateId ?? null,
        });
        return res.json({ user: membership });
    }
    catch (error) {
        console.error('updateCompanyUser error:', error);
        return handleAccessError(res, error, 'Erro ao atualizar usuário');
    }
}
async function updateMembershipAccess(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const membershipId = getParamString(req.params.id);
        if (!membershipId)
            return res.status(400).json({ error: 'membershipId is required' });
        const systemRole = req.body?.systemRole;
        if (systemRole !== 'ADMIN' && systemRole !== 'CUSTOM')
            return res.status(400).json({ error: 'Tipo de acesso inválido.' });
        const membership = await accessService.updateMembershipAccess({
            companyId,
            userId: req.user?.id ?? null,
            membershipId,
            systemRole,
            customRoleId: req.body?.customRoleId ?? null,
            activeEventDateId: req.body?.activeEventDateId ?? null,
        });
        return res.json({ membership });
    }
    catch (error) {
        console.error('updateMembershipAccess error:', error);
        return handleAccessError(res, error, 'Erro ao atualizar acesso');
    }
}
async function getAssignableEventDates(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const eventDates = await accessService.listAssignableEventDates(companyId);
        return res.json({ eventDates });
    }
    catch (error) {
        console.error('getAssignableEventDates error:', error);
        return handleAccessError(res, error, 'Erro ao listar eventos para acesso');
    }
}
async function updateMyActiveEventDate(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        if (!req.user?.id)
            return res.status(401).json({ error: 'Unauthorized' });
        const result = await accessService.updateMyActiveEventDate({
            companyId,
            userId: req.user.id,
            activeEventDateId: req.body?.activeEventDateId ?? null,
        });
        return res.json(result);
    }
    catch (error) {
        console.error('updateMyActiveEventDate error:', error);
        return handleAccessError(res, error, 'Erro ao atualizar evento ativo');
    }
}
