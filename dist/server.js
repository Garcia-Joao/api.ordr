"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const prisma_1 = require("./lib/prisma");
const ensure_base_data_1 = require("./bootstrap/ensure-base-data");
const PORT = Number(process.env.PORT || 3000);
async function start() {
    try {
        console.log('[startup] Starting ORDR backend...');
        console.log('[startup] NODE_ENV:', process.env.NODE_ENV);
        console.log('[startup] PORT:', process.env.PORT);
        console.log('[startup] DATABASE_URL exists:', Boolean(process.env.DATABASE_URL));
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not defined');
        }
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        console.log('[startup] Database connected');
        await (0, ensure_base_data_1.ensureBaseData)();
        console.log('[startup] Base data ensured');
        app_1.default.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('[startup] Failed to start server:', error);
        process.exit(1);
    }
}
start();
