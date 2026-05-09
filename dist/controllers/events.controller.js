"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEventPeopleController = listEventPeopleController;
exports.listEventTemplatesController = listEventTemplatesController;
exports.getEventTemplateController = getEventTemplateController;
exports.createEventTemplateController = createEventTemplateController;
exports.updateEventTemplateController = updateEventTemplateController;
exports.deleteEventTemplateController = deleteEventTemplateController;
exports.listEventDatesController = listEventDatesController;
exports.listCurrentEventDatesController = listCurrentEventDatesController;
exports.getEventDateController = getEventDateController;
exports.createEventDateController = createEventDateController;
exports.updateEventDateController = updateEventDateController;
exports.updateEventDatePersonStatusController = updateEventDatePersonStatusController;
exports.cancelEventDateController = cancelEventDateController;
exports.deleteEventDateController = deleteEventDateController;
const events_service_1 = require("../services/events.service");
function getSingleParam(value, fieldName) {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (!normalized || typeof normalized !== 'string') {
        throw new Error(`${fieldName}_REQUIRED`);
    }
    return normalized;
}
function getCompanyId(req) {
    const user = req.user;
    const headerCompanyId = req.headers['x-company-id'];
    return (user?.companyId ??
        user?.company?.id ??
        getSingleParam(headerCompanyId, 'COMPANY_ID'));
}
function handleError(res, error) {
    const message = error?.message ?? 'INTERNAL_ERROR';
    const status = message.includes('NOT_FOUND')
        ? 404
        : message.includes('REQUIRED')
            ? 400
            : 500;
    return res.status(status).json({
        error: message,
    });
}
async function listEventPeopleController(req, res) {
    try {
        const people = await (0, events_service_1.listPeopleForEvents)();
        return res.json(people);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function listEventTemplatesController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const templates = await (0, events_service_1.listEventTemplates)(companyId);
        return res.json(templates);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getEventTemplateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const templateId = getSingleParam(req.params.id, 'EVENT_TEMPLATE_ID');
        const template = await (0, events_service_1.getEventTemplate)(companyId, templateId);
        return res.json(template);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createEventTemplateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const template = await (0, events_service_1.createEventTemplate)({
            companyId,
            ...req.body,
        });
        return res.status(201).json(template);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateEventTemplateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const templateId = getSingleParam(req.params.id, 'EVENT_TEMPLATE_ID');
        const template = await (0, events_service_1.updateEventTemplate)(companyId, templateId, req.body);
        return res.json(template);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deleteEventTemplateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const templateId = getSingleParam(req.params.id, 'EVENT_TEMPLATE_ID');
        const template = await (0, events_service_1.deleteEventTemplate)(companyId, templateId);
        return res.json(template);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function listEventDatesController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const from = typeof req.query.from === 'string' ? req.query.from : undefined;
        const to = typeof req.query.to === 'string' ? req.query.to : undefined;
        const status = typeof req.query.status === 'string'
            ? req.query.status
            : undefined;
        const dates = await (0, events_service_1.listEventDates)({
            companyId,
            from,
            to,
            status,
        });
        return res.json(dates);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function listCurrentEventDatesController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const dates = await (0, events_service_1.listCurrentEventDates)(companyId);
        return res.json(dates);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getEventDateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID');
        const eventDate = await (0, events_service_1.getEventDate)(companyId, eventDateId);
        return res.json(eventDate);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createEventDateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDate = await (0, events_service_1.createEventDate)({
            companyId,
            ...req.body,
        });
        return res.status(201).json(eventDate);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateEventDateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID');
        const eventDate = await (0, events_service_1.updateEventDate)(companyId, eventDateId, req.body);
        return res.json(eventDate);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function updateEventDatePersonStatusController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID');
        const personId = getSingleParam(req.params.personId, 'PERSON_ID');
        const result = await (0, events_service_1.updateEventDatePersonStatus)({
            companyId,
            eventDateId,
            personId,
            functionName: req.body.functionName ?? null,
            status: req.body.status,
            notes: req.body.notes ?? undefined,
            worksFullEvent: req.body.worksFullEvent,
            workHours: req.body.workHours,
            costOverride: req.body.costOverride,
            costNotes: req.body.costNotes ?? undefined,
        });
        return res.json(result);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function cancelEventDateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID');
        const eventDate = await (0, events_service_1.cancelEventDate)(companyId, eventDateId);
        return res.json(eventDate);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function deleteEventDateController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID');
        const eventDate = await (0, events_service_1.deleteEventDate)(companyId, eventDateId);
        return res.json(eventDate);
    }
    catch (error) {
        return handleError(res, error);
    }
}
