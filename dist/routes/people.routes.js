"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.peopleRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const require_permission_middleware_1 = require("../middleware/require-permission.middleware");
const people_service_1 = require("../services/people.service");
exports.peopleRoutes = (0, express_1.Router)();
function getParam(value) {
    return Array.isArray(value) ? value[0] : value ?? '';
}
exports.peopleRoutes.get('/', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('people.view'), async (_req, res) => {
    try {
        const people = await (0, people_service_1.listPeople)();
        res.json(people);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'PEOPLE_LIST_ERROR' });
    }
});
exports.peopleRoutes.get('/functions', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('people.view'), async (_req, res) => {
    try {
        const functions = await (0, people_service_1.listPersonFunctions)();
        res.json(functions);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'PEOPLE_FUNCTIONS_LIST_ERROR' });
    }
});
exports.peopleRoutes.post('/functions', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('people.manage'), async (req, res) => {
    try {
        const functionItem = await (0, people_service_1.createPersonFunction)(req.body);
        res.status(201).json(functionItem);
    }
    catch (error) {
        console.error(error);
        res.status(400).json({
            error: error?.message || 'PERSON_FUNCTION_CREATE_ERROR',
        });
    }
});
exports.peopleRoutes.post('/', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('people.manage'), async (req, res) => {
    try {
        const person = await (0, people_service_1.createPerson)(req.body);
        res.status(201).json(person);
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: error?.message || 'PERSON_CREATE_ERROR' });
    }
});
exports.peopleRoutes.put('/:id', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('people.manage'), async (req, res) => {
    try {
        const person = await (0, people_service_1.updatePerson)(getParam(req.params.id), req.body);
        res.json(person);
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: error?.message || 'PERSON_UPDATE_ERROR' });
    }
});
exports.peopleRoutes.patch('/:id/disable', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('people.manage'), async (req, res) => {
    try {
        const result = await (0, people_service_1.disablePerson)(getParam(req.params.id));
        res.json(result);
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: error?.message || 'PERSON_DISABLE_ERROR' });
    }
});
exports.peopleRoutes.patch('/:id/restore', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('people.manage'), async (req, res) => {
    try {
        const result = await (0, people_service_1.restorePerson)(getParam(req.params.id));
        res.json(result);
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: error?.message || 'PERSON_RESTORE_ERROR' });
    }
});
exports.peopleRoutes.delete('/:id', auth_middleware_1.requireAuth, (0, require_permission_middleware_1.requirePermission)('people.manage'), async (req, res) => {
    try {
        const result = await (0, people_service_1.deletePerson)(getParam(req.params.id));
        res.json(result);
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: error?.message || 'PERSON_DELETE_ERROR' });
    }
});
