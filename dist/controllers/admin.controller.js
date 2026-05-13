"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLoginController = adminLoginController;
exports.adminLogoutController = adminLogoutController;
exports.adminMeController = adminMeController;
exports.adminCreateUserController = adminCreateUserController;
exports.adminDeleteUserController = adminDeleteUserController;
exports.adminDeleteLicensePlanController = adminDeleteLicensePlanController;
exports.adminDeleteCompanyController = adminDeleteCompanyController;
exports.adminDeleteCompanyLicenseController = adminDeleteCompanyLicenseController;
exports.adminListLicensePlansController = adminListLicensePlansController;
exports.adminCreateLicensePlanController = adminCreateLicensePlanController;
exports.adminUpdateLicensePlanController = adminUpdateLicensePlanController;
exports.adminListCompaniesController = adminListCompaniesController;
exports.adminListUsersController = adminListUsersController;
exports.adminGetCompanyController = adminGetCompanyController;
exports.adminCreateCompanyController = adminCreateCompanyController;
exports.adminUpdateCompanyController = adminUpdateCompanyController;
exports.adminUpsertCompanyMembershipController = adminUpsertCompanyMembershipController;
exports.adminUpdateCompanyMembershipController = adminUpdateCompanyMembershipController;
exports.adminDeleteCompanyMembershipController = adminDeleteCompanyMembershipController;
exports.adminUpdateCompanyLicenseController = adminUpdateCompanyLicenseController;
exports.adminUpdateCompanyAccessController = adminUpdateCompanyAccessController;
exports.adminAssignCompanyLicenseController = adminAssignCompanyLicenseController;
const admin_service_1 = require("../services/admin.service");
function getParam(value, name) {
    if (!value) {
        throw new Error(`${name.toUpperCase()}_PARAM_REQUIRED`);
    }
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
function adminCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        domain: isProduction ? '.panelordr.com.br' : undefined,
        maxAge: 1000 * 60 * 60 * 24 * 7,
    };
}
async function adminLoginController(req, res) {
    try {
        const result = await (0, admin_service_1.loginAdmin)(req.body);
        res.cookie(admin_service_1.ADMIN_COOKIE_NAME, result.token, adminCookieOptions());
        return res.json({
            ok: true,
            admin: result.admin,
        });
    }
    catch (error) {
        console.error('[admin] login error:', error);
        return res.status(401).json({
            error: error?.message || 'ADMIN_LOGIN_ERROR',
        });
    }
}
async function adminLogoutController(_req, res) {
    res.clearCookie(admin_service_1.ADMIN_COOKIE_NAME, adminCookieOptions());
    return res.json({
        ok: true,
    });
}
async function adminMeController(req, res) {
    try {
        if (!req.admin?.id) {
            return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED' });
        }
        const result = await (0, admin_service_1.getAdminMe)(req.admin.id);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] me error:', error);
        return res.status(401).json({
            error: error?.message || 'ADMIN_ME_ERROR',
        });
    }
}
async function adminCreateUserController(req, res) {
    try {
        const result = await (0, admin_service_1.createUser)(req.body);
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('[admin] create app user error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_CREATE_USER_ERROR',
        });
    }
}
async function adminDeleteUserController(req, res) {
    try {
        const userId = getParam(req.params.userId, 'userId');
        const result = await (0, admin_service_1.deleteUser)(userId);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] delete user error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_DELETE_USER_ERROR',
        });
    }
}
async function adminDeleteLicensePlanController(req, res) {
    try {
        const id = getParam(req.params.id, 'id');
        const result = await (0, admin_service_1.deleteLicensePlan)(id);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] delete license plan error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_DELETE_LICENSE_PLAN_ERROR',
        });
    }
}
async function adminDeleteCompanyController(req, res) {
    try {
        const companyId = getParam(req.params.companyId, 'companyId');
        const result = await (0, admin_service_1.deleteCompany)(companyId);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] delete company error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_DELETE_COMPANY_ERROR',
        });
    }
}
async function adminDeleteCompanyLicenseController(req, res) {
    try {
        const licenseId = getParam(req.params.licenseId, 'licenseId');
        const result = await (0, admin_service_1.deleteCompanyLicense)(licenseId);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] delete company license error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_DELETE_COMPANY_LICENSE_ERROR',
        });
    }
}
async function adminListLicensePlansController(_req, res) {
    try {
        const result = await (0, admin_service_1.listLicensePlans)();
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] list license plans error:', error);
        return res.status(500).json({
            error: error?.message || 'ADMIN_LIST_LICENSE_PLANS_ERROR',
        });
    }
}
async function adminCreateLicensePlanController(req, res) {
    try {
        const result = await (0, admin_service_1.createLicensePlan)({
            ...req.body,
            adminId: req.admin?.id,
        });
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('[admin] create license plan error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_CREATE_LICENSE_PLAN_ERROR',
        });
    }
}
async function adminUpdateLicensePlanController(req, res) {
    try {
        const id = getParam(req.params.id, 'id');
        const result = await (0, admin_service_1.updateLicensePlan)(id, req.body);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] update license plan error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_UPDATE_LICENSE_PLAN_ERROR',
        });
    }
}
async function adminListCompaniesController(_req, res) {
    try {
        const result = await (0, admin_service_1.listCompanies)();
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] list companies error:', error);
        return res.status(500).json({
            error: error?.message || 'ADMIN_LIST_COMPANIES_ERROR',
        });
    }
}
async function adminListUsersController(_req, res) {
    try {
        const result = await (0, admin_service_1.listUsers)();
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] list users error:', error);
        return res.status(500).json({
            error: error?.message || 'ADMIN_LIST_USERS_ERROR',
        });
    }
}
async function adminGetCompanyController(req, res) {
    try {
        const companyId = getParam(req.params.companyId, 'companyId');
        const result = await (0, admin_service_1.getCompany)(companyId);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] get company error:', error);
        return res.status(404).json({
            error: error?.message || 'ADMIN_GET_COMPANY_ERROR',
        });
    }
}
async function adminCreateCompanyController(req, res) {
    try {
        const result = await (0, admin_service_1.createCompanyWithInitialAccess)({
            ...req.body,
            adminId: req.admin?.id,
        });
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('[admin] create company error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_CREATE_COMPANY_ERROR',
        });
    }
}
async function adminUpdateCompanyController(req, res) {
    try {
        const companyId = getParam(req.params.companyId, 'companyId');
        const result = await (0, admin_service_1.updateCompany)(companyId, req.body);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] update company error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_UPDATE_COMPANY_ERROR',
        });
    }
}
async function adminUpsertCompanyMembershipController(req, res) {
    try {
        const result = await (0, admin_service_1.upsertCompanyMembership)(req.body);
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('[admin] upsert company membership error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_UPSERT_COMPANY_MEMBERSHIP_ERROR',
        });
    }
}
async function adminUpdateCompanyMembershipController(req, res) {
    try {
        const membershipId = getParam(req.params.membershipId, 'membershipId');
        const result = await (0, admin_service_1.updateCompanyMembership)(membershipId, req.body);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] update company membership error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_UPDATE_COMPANY_MEMBERSHIP_ERROR',
        });
    }
}
async function adminDeleteCompanyMembershipController(req, res) {
    try {
        const membershipId = getParam(req.params.membershipId, 'membershipId');
        const result = await (0, admin_service_1.deleteCompanyMembership)(membershipId);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] delete company membership error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_DELETE_COMPANY_MEMBERSHIP_ERROR',
        });
    }
}
async function adminUpdateCompanyLicenseController(req, res) {
    try {
        const licenseId = getParam(req.params.licenseId, 'licenseId');
        const result = await (0, admin_service_1.updateCompanyLicense)(licenseId, req.body);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] update company license error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_UPDATE_COMPANY_LICENSE_ERROR',
        });
    }
}
async function adminUpdateCompanyAccessController(req, res) {
    try {
        const companyId = getParam(req.params.companyId, 'companyId');
        const result = await (0, admin_service_1.updateCompanyAccess)(companyId, req.body);
        return res.json(result);
    }
    catch (error) {
        console.error('[admin] update company access error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_UPDATE_COMPANY_ACCESS_ERROR',
        });
    }
}
async function adminAssignCompanyLicenseController(req, res) {
    try {
        const companyId = getParam(req.params.companyId, 'companyId');
        const result = await (0, admin_service_1.assignCompanyLicense)({
            companyId,
            planId: req.body.planId,
            startsAt: req.body.startsAt,
            notes: req.body.notes,
            adminId: req.admin?.id,
        });
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('[admin] assign company license error:', error);
        return res.status(400).json({
            error: error?.message || 'ADMIN_ASSIGN_COMPANY_LICENSE_ERROR',
        });
    }
}
