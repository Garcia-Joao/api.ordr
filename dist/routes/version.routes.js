"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const version_controller_1 = require("../controllers/version.controller");
const router = (0, express_1.Router)();
router.get('/', version_controller_1.versionCheck);
exports.default = router;
