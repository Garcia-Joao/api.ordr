"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const require_permission_middleware_1 = require("../middleware/require-permission.middleware");
const companies_controller_1 = require("../controllers/companies.controller");
const router = (0, express_1.Router)();
router.post('/create-test-company', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('settings.update'), companies_controller_1.createTestCompany);
exports.default = router;
