"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportsFiltersController = getReportsFiltersController;
exports.getReportsDashboardController = getReportsDashboardController;
const reports_service_1 = require("../services/reports.service");
function getCompanyId(req) {
    return req.user?.companyId;
}
function getQueryString(req, key) {
    const value = req.query[key];
    if (Array.isArray(value))
        return String(value[0] ?? '').trim() || undefined;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
async function getReportsFiltersController(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.json(await (0, reports_service_1.getReportFilters)(companyId));
    }
    catch (error) {
        console.error('getReportsFiltersController error:', error);
        return res.status(500).json({ error: error?.message || 'FAILED_TO_LOAD_REPORT_FILTERS' });
    }
}
async function getReportsDashboardController(req, res) {
    try {
        const companyId = getCompanyId(req);
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.json(await (0, reports_service_1.getReportsDashboard)(companyId, {
            fromDate: getQueryString(req, 'fromDate'),
            toDate: getQueryString(req, 'toDate'),
            status: getQueryString(req, 'status'),
            paymentMethod: getQueryString(req, 'paymentMethod'),
            eventDateId: getQueryString(req, 'eventDateId'),
            salesEnvironmentId: getQueryString(req, 'salesEnvironmentId'),
            categoryId: getQueryString(req, 'categoryId'),
            productId: getQueryString(req, 'productId'),
            customerId: getQueryString(req, 'customerId'),
            internalCustomerId: getQueryString(req, 'internalCustomerId'),
            comanda: getQueryString(req, 'comanda'),
            taxApplied: getQueryString(req, 'taxApplied'),
        }));
    }
    catch (error) {
        console.error('getReportsDashboardController error:', error);
        return res.status(500).json({ error: error?.message || 'FAILED_TO_LOAD_REPORTS_DASHBOARD' });
    }
}
