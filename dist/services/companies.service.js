"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestCompanyFromCompany = createTestCompanyFromCompany;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
async function createTestCompanyFromCompany({ userId, sourceCompanyId, copyData, }) {
    const sourceCompany = await prisma_1.prisma.company.findUnique({
        where: { id: sourceCompanyId },
        include: {
            categories: true,
            products: {
                include: {
                    variationGroups: {
                        include: {
                            options: true,
                        },
                        orderBy: {
                            sortOrder: 'asc',
                        },
                    },
                },
                orderBy: {
                    createdAt: 'asc',
                },
            },
            memberships: true,
        },
    });
    if (!sourceCompany) {
        throw new Error('SOURCE_COMPANY_NOT_FOUND');
    }
    const existingTestCount = await prisma_1.prisma.company.count({
        where: {
            name: {
                startsWith: `${sourceCompany.name} - Teste`,
            },
        },
    });
    const suffix = existingTestCount === 0 ? '' : ` ${existingTestCount + 1}`;
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const newCompany = await tx.company.create({
            data: {
                name: `${sourceCompany.name} - Teste${suffix}`,
                isTest: true,
            },
        });
        await tx.userCompany.create({
            data: {
                userId,
                companyId: newCompany.id,
                role: 'admin',
            },
        });
        if (!copyData) {
            return newCompany;
        }
        const categoryIdMap = new Map();
        for (const category of sourceCompany.categories) {
            const createdCategory = await tx.category.create({
                data: {
                    companyId: newCompany.id,
                    name: category.name,
                    slug: category.slug,
                    emoji: category.emoji,
                },
            });
            categoryIdMap.set(category.id, createdCategory.id);
        }
        for (const product of sourceCompany.products) {
            const mappedCategoryId = product.categoryId
                ? categoryIdMap.get(product.categoryId)
                : null;
            if (!mappedCategoryId) {
                throw new Error('PRODUCT_CATEGORY_NOT_FOUND');
            }
            const createdProduct = await tx.product.create({
                data: {
                    companyId: newCompany.id,
                    categoryId: mappedCategoryId,
                    name: product.name,
                    description: product.description,
                    emoji: product.emoji,
                    price: new client_1.Prisma.Decimal(product.price),
                    active: product.active,
                },
            });
            for (const group of product.variationGroups) {
                const createdGroup = await tx.productVariationGroup.create({
                    data: {
                        productId: createdProduct.id,
                        name: group.name,
                        required: group.required,
                        sortOrder: group.sortOrder,
                        selectionType: group.selectionType,
                    },
                });
                for (const option of group.options) {
                    await tx.productVariationOption.create({
                        data: {
                            groupId: createdGroup.id,
                            name: option.name,
                            priceModifier: new client_1.Prisma.Decimal(option.priceModifier),
                            sortOrder: option.sortOrder,
                            active: option.active,
                        },
                    });
                }
            }
        }
        return newCompany;
    });
    return {
        ok: true,
        company: result,
    };
}
