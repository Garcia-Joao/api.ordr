"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPeopleFunctions = seedPeopleFunctions;
const prisma_1 = require("../lib/prisma");
const defaultFunctions = [
    'Barman',
    'Garçom',
    'Caixa',
    'Cozinha',
    'Músico',
    'Técnico de som',
    'Técnico de luz',
    'Manutenção',
    'Segurança',
    'Limpeza',
    'Produção',
    'Fotógrafo',
    'DJ',
];
async function seedPeopleFunctions() {
    for (const name of defaultFunctions) {
        await prisma_1.prisma.personFunction.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }
}
