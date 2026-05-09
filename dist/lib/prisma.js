"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
/// <reference types="node" />
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
}
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
exports.prisma = global.prisma ??
    new client_1.PrismaClient({
        adapter,
        log: ['query', 'info', 'warn', 'error'],
    });
if (process.env.NODE_ENV !== 'production') {
    global.prisma = exports.prisma;
}
