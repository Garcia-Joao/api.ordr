"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestCompanyFromCompany = createTestCompanyFromCompany;
exports.deleteTestCompany = deleteTestCompany;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
async function assertAdminAccess(userId, companyId) {
    const membership = await prisma_1.prisma.userCompany.findUnique({
        where: {
            userId_companyId: {
                userId,
                companyId,
            },
        },
        select: {
            id: true,
            systemRole: true,
        },
    });
    if (!membership) {
        throw new Error('COMPANY_ACCESS_DENIED');
    }
    if (membership.systemRole !== 'ADMIN') {
        throw new Error('ADMIN_ACCESS_REQUIRED');
    }
}
async function createTestCompanyFromCompany({ userId, sourceCompanyId, copyData, }) {
    await assertAdminAccess(userId, sourceCompanyId);
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
            testCompanies: true,
        },
    });
    if (!sourceCompany) {
        throw new Error('SOURCE_COMPANY_NOT_FOUND');
    }
    if (sourceCompany.isTest) {
        throw new Error('SOURCE_COMPANY_IS_ALREADY_TEST');
    }
    const existingTestCompany = await prisma_1.prisma.company.findFirst({
        where: {
            testSourceCompanyId: sourceCompany.id,
            isTest: true,
        },
    });
    if (existingTestCompany) {
        await prisma_1.prisma.userCompany.upsert({
            where: {
                userId_companyId: {
                    userId,
                    companyId: existingTestCompany.id,
                },
            },
            create: {
                userId,
                companyId: existingTestCompany.id,
                role: 'admin',
                systemRole: 'ADMIN',
            },
            update: {},
        });
        return {
            ok: true,
            alreadyExists: true,
            company: existingTestCompany,
        };
    }
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const newCompany = await tx.company.create({
            data: {
                name: `${sourceCompany.name} - Teste`,
                isTest: true,
                testSourceCompanyId: sourceCompany.id,
                platformAccessStatus: sourceCompany.platformAccessStatus,
            },
        });
        await tx.userCompany.create({
            data: {
                userId,
                companyId: newCompany.id,
                role: 'admin',
                systemRole: 'ADMIN',
            },
        });
        if (!copyData) {
            await tx.salesEnvironment.create({
                data: {
                    companyId: newCompany.id,
                    name: 'Default',
                    color: '#dd7c12',
                    isDefault: true,
                    active: true,
                },
            });
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
        const defaultEnvironment = await tx.salesEnvironment.create({
            data: {
                companyId: newCompany.id,
                name: 'Default',
                color: '#dd7c12',
                isDefault: true,
                active: true,
            },
        });
        for (const product of sourceCompany.products) {
            const mappedCategoryId = categoryIdMap.get(product.categoryId);
            if (!mappedCategoryId) {
                throw new Error(`CATEGORY_NOT_MAPPED_FOR_PRODUCT_${product.id}`);
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
                    isStockOnly: product.isStockOnly,
                    trackStock: product.trackStock,
                    stockQuantity: product.stockQuantity,
                    minStock: product.minStock,
                    unitContentQuantity: product.unitContentQuantity
                        ? new client_1.Prisma.Decimal(product.unitContentQuantity)
                        : null,
                    unitContentUnit: product.unitContentUnit,
                    costMode: product.costMode,
                    simpleCost: product.simpleCost
                        ? new client_1.Prisma.Decimal(product.simpleCost)
                        : null,
                    stockUnit: product.stockUnit,
                    referenceQuantity: product.referenceQuantity
                        ? new client_1.Prisma.Decimal(product.referenceQuantity)
                        : null,
                    referenceCost: product.referenceCost
                        ? new client_1.Prisma.Decimal(product.referenceCost)
                        : null,
                    madeOnDemand: product.madeOnDemand,
                    unlimitedStock: product.unlimitedStock,
                    recipeOutputQuantity: product.recipeOutputQuantity
                        ? new client_1.Prisma.Decimal(product.recipeOutputQuantity)
                        : null,
                    recipeOutputUnit: product.recipeOutputUnit,
                },
            });
            await tx.productEnvironmentPrice.create({
                data: {
                    productId: createdProduct.id,
                    salesEnvironmentId: defaultEnvironment.id,
                    price: new client_1.Prisma.Decimal(product.price),
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
                            costMode: option.costMode,
                            simpleCost: option.simpleCost
                                ? new client_1.Prisma.Decimal(option.simpleCost)
                                : null,
                            stockUnit: option.stockUnit,
                            referenceQuantity: option.referenceQuantity
                                ? new client_1.Prisma.Decimal(option.referenceQuantity)
                                : null,
                            referenceCost: option.referenceCost
                                ? new client_1.Prisma.Decimal(option.referenceCost)
                                : null,
                        },
                    });
                }
            }
        }
        return newCompany;
    });
    return {
        ok: true,
        alreadyExists: false,
        company: result,
    };
}
async function deleteTestCompany({ userId, companyId }) {
    const company = await prisma_1.prisma.company.findUnique({
        where: { id: companyId },
        select: {
            id: true,
            name: true,
            isTest: true,
            testSourceCompanyId: true,
        },
    });
    if (!company) {
        throw new Error('COMPANY_NOT_FOUND');
    }
    if (!company.isTest) {
        throw new Error('ONLY_TEST_COMPANY_CAN_BE_DELETED');
    }
    await assertAdminAccess(userId, company.id);
    await prisma_1.prisma.company.delete({
        where: { id: company.id },
    });
    return {
        ok: true,
        deletedCompany: company,
    };
}
