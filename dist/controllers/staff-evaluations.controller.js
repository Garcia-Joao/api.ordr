"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStaffEvaluationCriteriaController = listStaffEvaluationCriteriaController;
exports.createStaffEvaluationCriterionController = createStaffEvaluationCriterionController;
exports.listEventStaffForReviewController = listEventStaffForReviewController;
exports.saveStaffEvaluationController = saveStaffEvaluationController;
exports.getPeopleEvaluationRatingsController = getPeopleEvaluationRatingsController;
exports.getPersonEvaluationSummaryController = getPersonEvaluationSummaryController;
const staff_evaluations_service_1 = require("../services/staff-evaluations.service");
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
    const companyId = user?.companyId ??
        user?.company?.id ??
        getSingleParam(headerCompanyId, 'COMPANY_ID');
    return companyId;
}
function handleError(res, error) {
    const message = error?.message ?? 'INTERNAL_ERROR';
    const status = message.includes('NOT_FOUND')
        ? 404
        : message.includes('REQUIRED') || message.includes('INVALID') || message.includes('FINISHED')
            ? 400
            : 500;
    return res.status(status).json({ error: message });
}
async function listStaffEvaluationCriteriaController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const criteria = await (0, staff_evaluations_service_1.listStaffEvaluationCriteria)(companyId);
        return res.json(criteria);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function createStaffEvaluationCriterionController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const criterion = await (0, staff_evaluations_service_1.createStaffEvaluationCriterion)({
            companyId,
            name: req.body.name,
            description: req.body.description ?? null,
        });
        return res.status(201).json(criterion);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function listEventStaffForReviewController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = getSingleParam(req.params.eventDateId, 'EVENT_DATE_ID');
        const staff = await (0, staff_evaluations_service_1.listEventStaffForReview)(companyId, eventDateId);
        return res.json(staff);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function saveStaffEvaluationController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const eventDateId = getSingleParam(req.params.eventDateId, 'EVENT_DATE_ID');
        const evaluation = await (0, staff_evaluations_service_1.saveStaffEvaluation)({
            companyId,
            eventDateId,
            personId: req.body.personId,
            functionName: req.body.functionName,
            functionScore: req.body.functionScore,
            generalNotes: req.body.generalNotes ?? null,
            scores: req.body.scores ?? [],
        });
        return res.json(evaluation);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getPeopleEvaluationRatingsController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const ratings = await (0, staff_evaluations_service_1.getPeopleEvaluationRatings)(companyId);
        return res.json(ratings);
    }
    catch (error) {
        return handleError(res, error);
    }
}
async function getPersonEvaluationSummaryController(req, res) {
    try {
        const companyId = getCompanyId(req);
        const personId = getSingleParam(req.params.personId, 'PERSON_ID');
        const summary = await (0, staff_evaluations_service_1.getPersonEvaluationSummary)(companyId, personId);
        return res.json(summary);
    }
    catch (error) {
        return handleError(res, error);
    }
}
