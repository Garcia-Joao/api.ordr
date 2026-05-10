"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const products_routes_1 = __importDefault(require("./routes/products.routes"));
const categories_routes_1 = __importDefault(require("./routes/categories.routes"));
const orders_routes_1 = __importDefault(require("./routes/orders.routes"));
const companies_routes_1 = __importDefault(require("./routes/companies.routes"));
const internal_customers_routes_1 = require("./routes/internal-customers.routes");
const sales_environments_routes_1 = __importDefault(require("./routes/sales-environments.routes"));
const stock_routes_1 = __importDefault(require("./routes/stock.routes"));
const printers_routes_1 = __importDefault(require("./routes/printers.routes"));
const people_routes_1 = require("./routes/people.routes");
const events_routes_1 = __importDefault(require("./routes/events.routes"));
const customers_routes_1 = __importDefault(require("./routes/customers.routes"));
const staff_evaluations_routes_1 = __importDefault(require("./routes/staff-evaluations.routes"));
const buys_routes_1 = __importDefault(require("./routes/buys.routes"));
const reports_routes_1 = __importDefault(require("./routes/reports.routes"));
const product_cost_history_routes_1 = __importDefault(require("./routes/product-cost-history.routes"));
const access_routes_1 = __importDefault(require("./routes/access.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const prisma_1 = require("./lib/prisma");
const app = (0, express_1.default)();
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://192.168.15.4:3001',
    process.env.FRONTEND_URL,
    process.env.FRONTEND_LAN_URL,
].filter(Boolean);
app.use((req, _res, next) => {
    console.log('[request]', req.method, req.path, 'origin:', req.headers.origin);
    next();
});
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.error('[cors] blocked origin:', origin);
        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id'],
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        return res.json({
            ok: true,
            db: 'connected',
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            db: 'disconnected',
        });
    }
});
app.get('/auth/me', (req, res, next) => {
    if (!req.cookies?.auth) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    return next();
});
app.use('/auth', auth_routes_1.default);
app.use('/products', products_routes_1.default);
app.use('/categories', categories_routes_1.default);
app.use('/orders', orders_routes_1.default);
app.use('/companies', companies_routes_1.default);
app.use('/internal-customers', internal_customers_routes_1.internalCustomersRoutes);
app.use('/sales-environments', sales_environments_routes_1.default);
app.use('/stock', stock_routes_1.default);
app.use('/printers', printers_routes_1.default);
app.use('/people', people_routes_1.peopleRoutes);
app.use('/events', events_routes_1.default);
app.use('/customers', customers_routes_1.default);
app.use('/staff-evaluations', staff_evaluations_routes_1.default);
app.use('/buys', buys_routes_1.default);
app.use('/reports', reports_routes_1.default);
app.use('/product-cost-history', product_cost_history_routes_1.default);
app.use('/access', access_routes_1.default);
app.use('/audit', audit_routes_1.default);
exports.default = app;
