"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductsByCompany = getProductsByCompany;
exports.getProductById = getProductById;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const audit_service_1 = require("./audit.service");
const product_cost_history_service_1 = require("./product-cost-history.service");
function convertToBaseUnit(quantity, unit) {
    switch (unit) {
        case "l":
            return quantity * 1000;
        case "kg":
            return quantity * 1000;
        default:
            return quantity;
    }
}
function decimalAuditValue(value) {
    if (value === null || typeof value === "undefined")
        return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
}
function recipeItemsAuditSnapshot(items) {
    return (items ?? [])
        .map((item) => ({
        // Do not store the RecipeItem row id in the audit snapshot.
        // Recipe rows can be deleted/recreated during product saves even when the
        // logical recipe did not change, and including the row id creates false
        // variation/recipe changes in the audit screen.
        ingredientProductId: item.ingredientProductId,
        ingredientProductName: item.ingredientProduct?.name ?? item.ingredientProductName ?? null,
        ingredientProductEmoji: item.ingredientProduct?.emoji ?? null,
        categoryName: item.ingredientProduct?.category?.name ?? null,
        quantity: decimalAuditValue(item.quantity),
        unit: item.unit,
    }))
        .sort((a, b) => String(a.ingredientProductName ?? a.ingredientProductId ?? "").localeCompare(String(b.ingredientProductName ?? b.ingredientProductId ?? "")));
}
function variationGroupsAuditSnapshot(product) {
    return (product.variationGroups ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        required: Boolean(group.required),
        selectionType: group.selectionType,
        sortOrder: Number(group.sortOrder ?? 0),
        options: (group.options ?? []).map((option) => ({
            id: option.id,
            name: option.name,
            priceModifier: decimalAuditValue(option.priceModifier),
            active: Boolean(option.active),
            sortOrder: Number(option.sortOrder ?? 0),
            costMode: option.costMode ?? "simple",
            simpleCost: decimalAuditValue(option.simpleCost),
            stockUnit: option.stockUnit ?? null,
            referenceQuantity: decimalAuditValue(option.referenceQuantity),
            referenceCost: decimalAuditValue(option.referenceCost),
            environmentPrices: (option.environmentPrices ?? [])
                .map((item) => ({
                salesEnvironmentId: item.salesEnvironmentId,
                salesEnvironmentName: item.salesEnvironment?.name ?? null,
                priceModifier: decimalAuditValue(item.priceModifier),
            }))
                .sort((a, b) => String(a.salesEnvironmentName ?? a.salesEnvironmentId ?? "").localeCompare(String(b.salesEnvironmentName ?? b.salesEnvironmentId ?? ""))),
            recipeItems: recipeItemsAuditSnapshot(option.recipeItems),
        })).sort((a, b) => String(a.name ?? a.id ?? "").localeCompare(String(b.name ?? b.id ?? ""))),
    })).sort((a, b) => String(a.name ?? a.id ?? "").localeCompare(String(b.name ?? b.id ?? "")));
}
function productCostAuditSnapshot(product) {
    return {
        simpleCost: decimalAuditValue(product.simpleCost),
        referenceCost: decimalAuditValue(product.referenceCost),
        referenceQuantity: decimalAuditValue(product.referenceQuantity),
        stockUnit: product.stockUnit ?? null,
        unitContentQuantity: decimalAuditValue(product.unitContentQuantity),
        unitContentUnit: product.unitContentUnit ?? null,
        recipeOutputQuantity: decimalAuditValue(product.recipeOutputQuantity),
        recipeOutputUnit: product.recipeOutputUnit ?? null,
        costMode: product.costMode ?? null,
        recipeItems: recipeItemsAuditSnapshot(product.recipeItems),
        variationGroups: variationGroupsAuditSnapshot(product).map((group) => ({
            id: group.id,
            options: group.options.map((option) => ({
                id: option.id,
                costMode: option.costMode,
                simpleCost: option.simpleCost,
                stockUnit: option.stockUnit,
                referenceQuantity: option.referenceQuantity,
                referenceCost: option.referenceCost,
                recipeItems: option.recipeItems,
            })),
        })),
    };
}
function stableStringify(value) {
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value;
        return `{${Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value) ?? "undefined";
}
function hasActualCostChange(oldProduct, newProduct) {
    return (stableStringify(productCostAuditSnapshot(oldProduct)) !==
        stableStringify(productCostAuditSnapshot(newProduct)));
}
function productAuditSnapshot(product) {
    return {
        name: product.name,
        description: product.description ?? null,
        emoji: product.emoji ?? null,
        categoryId: product.categoryId,
        printPortId: product.printPortId ?? null,
        categoryName: product.category?.name ?? null,
        price: decimalAuditValue(product.price),
        active: product.active,
        isStockOnly: product.isStockOnly,
        trackStock: product.trackStock,
        stockQuantity: decimalAuditValue(product.stockQuantity),
        minStock: decimalAuditValue(product.minStock),
        costMode: product.costMode,
        simpleCost: decimalAuditValue(product.simpleCost),
        stockUnit: product.stockUnit ?? null,
        referenceQuantity: decimalAuditValue(product.referenceQuantity),
        referenceCost: decimalAuditValue(product.referenceCost),
        unitContentQuantity: decimalAuditValue(product.unitContentQuantity),
        unitContentUnit: product.unitContentUnit ?? null,
        madeOnDemand: product.madeOnDemand,
        unlimitedStock: product.unlimitedStock,
        recipeOutputQuantity: decimalAuditValue(product.recipeOutputQuantity),
        recipeOutputUnit: product.recipeOutputUnit ?? null,
        recipeItems: recipeItemsAuditSnapshot(product.recipeItems),
        // Important: keep variationGroups inside the normal audit snapshot.
        // The previous version created PRODUCT_UPDATED audit rows for variation edits,
        // but did not include the variation data in oldValues/newValues, so the
        // audit screen had nothing to render and appeared blank.
        variationGroups: variationGroupsAuditSnapshot(product),
    };
}
function normalizeProduct(product) {
    const normalizedRecipeItems = (product.recipeItems ?? []).map((item) => {
        const ingredient = item.ingredientProduct;
        const referenceQuantity = Number(ingredient?.referenceQuantity ?? 0);
        const referenceCost = Number(ingredient?.referenceCost ?? 0);
        const ingredientBaseReference = referenceQuantity > 0
            ? convertToBaseUnit(referenceQuantity, ingredient?.stockUnit ?? item.unit)
            : 0;
        const recipeBaseQuantity = convertToBaseUnit(Number(item.quantity), item.unit);
        const computedCost = ingredientBaseReference > 0
            ? (referenceCost / ingredientBaseReference) * recipeBaseQuantity
            : 0;
        return {
            ...item,
            quantity: Number(item.quantity),
            computedCost,
            ingredientProduct: ingredient
                ? {
                    ...ingredient,
                    price: Number(ingredient.price),
                    simpleCost: ingredient.simpleCost == null
                        ? null
                        : Number(ingredient.simpleCost),
                    referenceQuantity: ingredient.referenceQuantity == null
                        ? null
                        : Number(ingredient.referenceQuantity),
                    referenceCost: ingredient.referenceCost == null
                        ? null
                        : Number(ingredient.referenceCost),
                    unitContentQuantity: ingredient.unitContentQuantity == null
                        ? null
                        : Number(ingredient.unitContentQuantity),
                    unitContentUnit: ingredient.unitContentUnit ?? null,
                    recipeOutputQuantity: ingredient.recipeOutputQuantity == null
                        ? null
                        : Number(ingredient.recipeOutputQuantity),
                    recipeOutputUnit: ingredient.recipeOutputUnit ?? null,
                    madeOnDemand: Boolean(ingredient.madeOnDemand),
                    unlimitedStock: Boolean(ingredient.unlimitedStock),
                }
                : null,
        };
    });
    const recipeCost = normalizedRecipeItems.reduce((sum, item) => sum + Number(item.computedCost ?? 0), 0);
    return {
        ...product,
        price: Number(product.price),
        simpleCost: product.simpleCost == null ? null : Number(product.simpleCost),
        referenceQuantity: product.referenceQuantity == null
            ? null
            : Number(product.referenceQuantity),
        referenceCost: product.referenceCost == null ? null : Number(product.referenceCost),
        unitContentQuantity: product.unitContentQuantity == null
            ? null
            : Number(product.unitContentQuantity),
        unitContentUnit: product.unitContentUnit ?? null,
        recipeOutputQuantity: product.recipeOutputQuantity == null
            ? null
            : Number(product.recipeOutputQuantity),
        recipeOutputUnit: product.recipeOutputUnit ?? null,
        madeOnDemand: Boolean(product.madeOnDemand),
        unlimitedStock: Boolean(product.unlimitedStock),
        recipeCost,
        recipeItems: normalizedRecipeItems,
        environmentPrices: (product.environmentPrices ?? []).map((item) => ({
            ...item,
            price: Number(item.price),
        })),
        variationGroups: (product.variationGroups ?? [])
            .filter((group) => (group.options ?? []).length > 0)
            .map((group) => ({
            ...group,
            options: (group.options ?? []).map((option) => {
                const normalizedOptionRecipeItems = (option.recipeItems ?? []).map((item) => {
                    const ingredient = item.ingredientProduct;
                    const referenceQuantity = Number(ingredient?.referenceQuantity ?? 0);
                    const referenceCost = Number(ingredient?.referenceCost ?? 0);
                    const ingredientBaseReference = referenceQuantity > 0
                        ? convertToBaseUnit(referenceQuantity, ingredient?.stockUnit ?? item.unit)
                        : 0;
                    const recipeBaseQuantity = convertToBaseUnit(Number(item.quantity), item.unit);
                    const computedCost = ingredientBaseReference > 0
                        ? (referenceCost / ingredientBaseReference) *
                            recipeBaseQuantity
                        : 0;
                    return {
                        ...item,
                        quantity: Number(item.quantity),
                        computedCost,
                        ingredientProduct: ingredient
                            ? {
                                ...ingredient,
                                price: Number(ingredient.price),
                                simpleCost: ingredient.simpleCost == null
                                    ? null
                                    : Number(ingredient.simpleCost),
                                referenceQuantity: ingredient.referenceQuantity == null
                                    ? null
                                    : Number(ingredient.referenceQuantity),
                                referenceCost: ingredient.referenceCost == null
                                    ? null
                                    : Number(ingredient.referenceCost),
                                unitContentQuantity: ingredient.unitContentQuantity == null
                                    ? null
                                    : Number(ingredient.unitContentQuantity),
                                unitContentUnit: ingredient.unitContentUnit ?? null,
                            }
                            : null,
                    };
                });
                const recipeCost = normalizedOptionRecipeItems.reduce((sum, item) => sum + Number(item.computedCost ?? 0), 0);
                return {
                    ...option,
                    priceModifier: Number(option.priceModifier),
                    costMode: option.costMode ?? "simple",
                    simpleCost: option.simpleCost == null ? null : Number(option.simpleCost),
                    stockUnit: option.stockUnit ?? null,
                    referenceQuantity: option.referenceQuantity == null
                        ? null
                        : Number(option.referenceQuantity),
                    referenceCost: option.referenceCost == null
                        ? null
                        : Number(option.referenceCost),
                    recipeCost,
                    recipeItems: normalizedOptionRecipeItems,
                    environmentPrices: (option.environmentPrices ?? []).map((item) => ({
                        ...item,
                        priceModifier: Number(item.priceModifier),
                    })),
                };
            }),
        }))
            .filter((group) => (group.options ?? []).length > 0),
    };
}
function validateRecipeOutput(data) {
    if (data.costMode !== "recipe")
        return;
    if (!data.recipeItems?.length) {
        throw new Error("RECIPE_ITEMS_REQUIRED");
    }
    if (!data.recipeOutputQuantity || data.recipeOutputQuantity <= 0) {
        throw new Error("RECIPE_OUTPUT_QUANTITY_REQUIRED");
    }
    if (!data.recipeOutputUnit) {
        throw new Error("RECIPE_OUTPUT_UNIT_REQUIRED");
    }
}
function pickProductCostHistorySnapshot(product) {
    return {
        categoryId: product.categoryId ?? null,
        categoryName: product.category?.name ?? product.categoryName ?? null,
        simpleCost: product.simpleCost ?? null,
        referenceCost: product.referenceCost ?? null,
        referenceQuantity: product.referenceQuantity ?? null,
        stockUnit: product.stockUnit ?? null,
        unitContentQuantity: product.unitContentQuantity ?? null,
        unitContentUnit: product.unitContentUnit ?? null,
    };
}
function hasCostRelevantInput(data) {
    const fields = [
        "categoryId",
        "costMode",
        "simpleCost",
        "stockUnit",
        "referenceQuantity",
        "referenceCost",
        "unitContentQuantity",
        "unitContentUnit",
        "recipeOutputQuantity",
        "recipeOutputUnit",
        "recipeItems",
    ];
    return fields.some((field) => Object.prototype.hasOwnProperty.call(data, field));
}
async function ensureCategoryBelongsToCompany(categoryId, companyId) {
    const category = await prisma_1.prisma.category.findFirst({
        where: {
            id: categoryId,
            companyId,
            deletedAt: null,
        },
    });
    if (!category) {
        throw new Error("CATEGORY_NOT_FOUND");
    }
    return category;
}
async function ensureRecipeIngredientsBelongToCompany(recipeItems, companyId, currentProductId) {
    if (!recipeItems?.length)
        return;
    for (const item of recipeItems) {
        if (!item.ingredientProductId) {
            throw new Error("RECIPE_INGREDIENT_REQUIRED");
        }
        if (currentProductId && item.ingredientProductId === currentProductId) {
            throw new Error("RECIPE_INGREDIENT_CANNOT_BE_SELF");
        }
        const ingredient = await prisma_1.prisma.product.findFirst({
            where: {
                id: item.ingredientProductId,
                companyId,
                active: true,
                deletedAt: null,
                OR: [
                    { trackStock: true },
                    { isStockOnly: true },
                    { unlimitedStock: true },
                ],
            },
        });
        if (!ingredient) {
            throw new Error("RECIPE_INGREDIENT_NOT_FOUND");
        }
    }
}
async function validateRecipeCycle(companyId, productId, recipeItems, visited = []) {
    for (const item of recipeItems) {
        const ingredientId = item.ingredientProductId;
        if (!ingredientId)
            continue;
        if (ingredientId === productId || visited.includes(ingredientId)) {
            throw new Error("RECIPE_CYCLE_DETECTED");
        }
        const ingredient = await prisma_1.prisma.product.findFirst({
            where: {
                id: ingredientId,
                companyId,
                active: true,
                deletedAt: null,
            },
            include: {
                recipeItems: true,
            },
        });
        if (!ingredient || !ingredient.recipeItems.length)
            continue;
        await validateRecipeCycle(companyId, productId, ingredient.recipeItems.map((recipeItem) => ({
            ingredientProductId: recipeItem.ingredientProductId,
            quantity: Number(recipeItem.quantity),
            unit: recipeItem.unit,
        })), [...visited, ingredientId]);
    }
}
const productInclude = {
    category: true,
    printPort: true,
    menuItems: {
        include: {
            menu: true,
        },
    },
    environmentPrices: {
        include: {
            salesEnvironment: true,
        },
    },
    recipeItems: {
        include: {
            ingredientProduct: {
                include: {
                    category: true,
                },
            },
        },
        orderBy: {
            createdAt: "asc",
        },
    },
    variationGroups: {
        orderBy: {
            sortOrder: "asc",
        },
        include: {
            options: {
                where: {
                    active: true,
                },
                orderBy: {
                    sortOrder: "asc",
                },
                include: {
                    environmentPrices: {
                        include: {
                            salesEnvironment: true,
                        },
                    },
                    recipeItems: {
                        include: {
                            ingredientProduct: {
                                include: {
                                    category: true,
                                },
                            },
                        },
                        orderBy: {
                            createdAt: "asc",
                        },
                    },
                },
            },
        },
    },
};
async function ensureVariationOptionIngredientsBelongToCompany(variationGroups, companyId, currentProductId) {
    if (!variationGroups?.length)
        return;
    for (const group of variationGroups) {
        for (const option of group.options ?? []) {
            for (const item of option.recipeItems ?? []) {
                if (!item.ingredientProductId) {
                    throw new Error("VARIATION_RECIPE_INGREDIENT_REQUIRED");
                }
                if (currentProductId && item.ingredientProductId === currentProductId) {
                    throw new Error("VARIATION_RECIPE_INGREDIENT_CANNOT_BE_SELF");
                }
                const ingredient = await prisma_1.prisma.product.findFirst({
                    where: {
                        id: item.ingredientProductId,
                        companyId,
                        active: true,
                        deletedAt: null,
                        OR: [
                            { trackStock: true },
                            { isStockOnly: true },
                            { unlimitedStock: true },
                        ],
                    },
                });
                if (!ingredient) {
                    throw new Error("VARIATION_RECIPE_INGREDIENT_NOT_FOUND");
                }
            }
        }
    }
}
function applyActiveMenuToProducts(products, activeMenu) {
    if (!activeMenu)
        return products;
    const menuItemsByProductId = new Map((activeMenu.items ?? [])
        .filter((item) => item.active)
        .map((item) => [item.productId, item]));
    return products
        .map((product) => {
        const menuItem = menuItemsByProductId.get(product.id);
        if (!menuItem)
            return null;
        return {
            ...product,
            price: Number(menuItem.price),
            menuPrice: Number(menuItem.price),
            activeMenuId: activeMenu.id,
            activeMenuName: activeMenu.name,
            menuItemId: menuItem.id,
        };
    })
        .filter(Boolean);
}
async function getProductsByCompany(companyId, includeInactive = false, options = {}) {
    const activeMenu = options.menu === 'active'
        ? await prisma_1.prisma.menu.findFirst({
            where: { companyId, active: true },
            include: { items: true },
        })
        : null;
    const products = await prisma_1.prisma.product.findMany({
        where: {
            companyId,
            deletedAt: null,
            ...(includeInactive ? {} : { active: true }),
        },
        include: productInclude,
        orderBy: {
            createdAt: "desc",
        },
    });
    const normalizedProducts = products.map(normalizeProduct);
    return options.menu === 'active'
        ? applyActiveMenuToProducts(normalizedProducts, activeMenu)
        : normalizedProducts;
}
async function getProductById(productId, companyId) {
    const product = await prisma_1.prisma.product.findFirst({
        where: {
            id: productId,
            companyId,
            deletedAt: null,
        },
        include: productInclude,
    });
    if (!product) {
        return null;
    }
    return normalizeProduct(product);
}
async function createProduct(data, userId) {
    if (!data.categoryId) {
        throw new Error("CATEGORY_REQUIRED");
    }
    await ensureCategoryBelongsToCompany(data.categoryId, data.companyId);
    await ensureRecipeIngredientsBelongToCompany(data.recipeItems, data.companyId);
    await ensureVariationOptionIngredientsBelongToCompany(data.variationGroups, data.companyId);
    validateRecipeOutput(data);
    if (data.costMode === "recipe" && data.recipeItems?.length) {
        await validateRecipeCycle(data.companyId, "__new__", data.recipeItems);
    }
    const createPayload = {
        categoryId: data.categoryId,
        name: data.name,
        description: data.description ?? null,
        emoji: data.emoji ?? null,
        price: new client_1.Prisma.Decimal(data.price ?? 0),
        active: data.active ?? true,
        isStockOnly: data.isStockOnly ?? false,
        trackStock: data.trackStock ?? false,
        stockQuantity: data.stockQuantity ?? 0,
        minStock: data.minStock ?? 0,
        costMode: data.costMode ?? "simple",
        simpleCost: data.simpleCost == null ? null : new client_1.Prisma.Decimal(data.simpleCost),
        stockUnit: data.stockUnit ?? null,
        referenceQuantity: data.referenceQuantity == null
            ? null
            : new client_1.Prisma.Decimal(data.referenceQuantity),
        referenceCost: data.referenceCost == null
            ? null
            : new client_1.Prisma.Decimal(data.referenceCost),
        unitContentQuantity: data.unitContentQuantity == null
            ? null
            : new client_1.Prisma.Decimal(data.unitContentQuantity),
        unitContentUnit: data.unitContentUnit ?? null,
        madeOnDemand: data.madeOnDemand ?? false,
        unlimitedStock: data.unlimitedStock ?? false,
        recipeOutputQuantity: data.recipeOutputQuantity == null
            ? null
            : new client_1.Prisma.Decimal(data.recipeOutputQuantity),
        recipeOutputUnit: data.recipeOutputUnit ?? null,
        printPortId: data.printPortId || null,
        recipeItems: {
            create: (data.recipeItems ?? []).map((item) => ({
                ingredientProductId: item.ingredientProductId,
                quantity: new client_1.Prisma.Decimal(item.quantity),
                unit: item.unit,
            })),
        },
        environmentPrices: {
            create: (data.isStockOnly ? [] : (data.environmentPrices ?? [])).map((item) => ({
                salesEnvironmentId: item.salesEnvironmentId,
                price: new client_1.Prisma.Decimal(item.price),
            })),
        },
        variationGroups: {
            create: (data.variationGroups ?? []).map((group, groupIndex) => ({
                name: group.name,
                selectionType: group.selectionType,
                required: group.required ?? false,
                sortOrder: group.sortOrder ?? groupIndex,
                options: {
                    create: (group.options ?? []).map((option, optionIndex) => ({
                        name: option.name,
                        priceModifier: new client_1.Prisma.Decimal(option.priceModifier ?? 0),
                        sortOrder: option.sortOrder ?? optionIndex,
                        active: option.active ?? true,
                        costMode: option.costMode ?? "simple",
                        simpleCost: option.costMode === "recipe" || option.simpleCost == null
                            ? null
                            : new client_1.Prisma.Decimal(option.simpleCost),
                        stockUnit: option.stockUnit ?? null,
                        referenceQuantity: option.costMode === "recipe" || option.referenceQuantity == null
                            ? null
                            : new client_1.Prisma.Decimal(option.referenceQuantity),
                        referenceCost: option.costMode === "recipe" || option.referenceCost == null
                            ? null
                            : new client_1.Prisma.Decimal(option.referenceCost),
                        environmentPrices: {
                            create: (option.environmentPrices ?? []).map((item) => ({
                                salesEnvironmentId: item.salesEnvironmentId,
                                priceModifier: new client_1.Prisma.Decimal(item.priceModifier),
                            })),
                        },
                        recipeItems: {
                            create: (option.recipeItems ?? []).map((item) => ({
                                ingredientProductId: item.ingredientProductId,
                                quantity: new client_1.Prisma.Decimal(item.quantity),
                                unit: item.unit,
                            })),
                        },
                    })),
                },
            })),
        },
    };
    const product = await prisma_1.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
            data: {
                companyId: data.companyId,
                createdByUserId: userId,
                updatedByUserId: userId,
                ...createPayload,
            },
            include: productInclude,
        });
        await (0, audit_service_1.createAuditLog)(tx, {
            companyId: data.companyId,
            userId,
            entityType: "Product",
            entityId: created.id,
            action: "PRODUCT_CREATED",
            newValues: {
                name: created.name,
                categoryId: created.categoryId,
                price: created.price,
                active: created.active,
                isStockOnly: created.isStockOnly,
                trackStock: created.trackStock,
            },
        });
        if (hasCostRelevantInput(data)) {
            await (0, product_cost_history_service_1.createProductCostHistoryEntry)({
                tx,
                companyId: data.companyId,
                productId: created.id,
                source: "product_edit",
                reason: "Custo inicial registrado no cadastro do produto",
                oldProduct: null,
                newProduct: pickProductCostHistorySnapshot(created),
                createdByUserId: userId,
                metadata: {
                    action: "PRODUCT_CREATED",
                },
            });
        }
        return created;
    });
    return normalizeProduct(product);
}
async function syncProductVariationGroups(params) {
    const { tx, productId, variationGroups } = params;
    function normalizeName(value) {
        return value.trim().toLowerCase();
    }
    const existingGroups = await tx.productVariationGroup.findMany({
        where: { productId },
        include: {
            options: {
                include: {
                    selectedInItems: true,
                    environmentPrices: true,
                    recipeItems: true,
                },
            },
            itemSelections: true,
        },
    });
    const incomingGroupKeys = new Set(variationGroups.map((group) => group.id ? `id:${group.id}` : `name:${normalizeName(group.name)}`));
    const removedGroups = existingGroups.filter((group) => {
        const idKey = `id:${group.id}`;
        const nameKey = `name:${normalizeName(group.name)}`;
        return !incomingGroupKeys.has(idKey) && !incomingGroupKeys.has(nameKey);
    });
    for (const group of removedGroups) {
        const groupWasUsed = group.itemSelections.length > 0 ||
            group.options.some((option) => option.selectedInItems.length > 0);
        if (groupWasUsed) {
            await tx.productVariationOption.updateMany({
                where: { groupId: group.id },
                data: { active: false },
            });
        }
        else {
            await tx.productVariationGroup.delete({
                where: { id: group.id },
            });
        }
    }
    for (const [groupIndex, group] of variationGroups.entries()) {
        const cleanGroupName = group.name.trim();
        const matchedExistingGroup = group.id
            ? existingGroups.find((existingGroup) => existingGroup.id === group.id)
            : existingGroups.find((existingGroup) => normalizeName(existingGroup.name) === normalizeName(cleanGroupName));
        const savedGroup = matchedExistingGroup
            ? await tx.productVariationGroup.update({
                where: { id: matchedExistingGroup.id },
                data: {
                    name: cleanGroupName,
                    required: group.required ?? false,
                    selectionType: group.selectionType,
                    sortOrder: group.sortOrder ?? groupIndex,
                },
            })
            : await tx.productVariationGroup.create({
                data: {
                    productId,
                    name: cleanGroupName,
                    required: group.required ?? false,
                    selectionType: group.selectionType,
                    sortOrder: group.sortOrder ?? groupIndex,
                },
            });
        const incomingOptions = group.options ?? [];
        const existingOptions = await tx.productVariationOption.findMany({
            where: { groupId: savedGroup.id },
            include: {
                selectedInItems: true,
            },
        });
        const incomingOptionKeys = new Set(incomingOptions.map((option) => option.id ? `id:${option.id}` : `name:${normalizeName(option.name)}`));
        const removedOptions = existingOptions.filter((option) => {
            const idKey = `id:${option.id}`;
            const nameKey = `name:${normalizeName(option.name)}`;
            return !incomingOptionKeys.has(idKey) && !incomingOptionKeys.has(nameKey);
        });
        for (const option of removedOptions) {
            if (option.selectedInItems.length > 0) {
                await tx.productVariationOption.update({
                    where: { id: option.id },
                    data: { active: false },
                });
            }
            else {
                await tx.productVariationOption.delete({
                    where: { id: option.id },
                });
            }
        }
        for (const [optionIndex, option] of incomingOptions.entries()) {
            const cleanOptionName = option.name.trim();
            const matchedExistingOption = option.id
                ? existingOptions.find((existingOption) => existingOption.id === option.id)
                : existingOptions.find((existingOption) => normalizeName(existingOption.name) ===
                    normalizeName(cleanOptionName));
            if (matchedExistingOption) {
                await tx.productVariationOption.update({
                    where: { id: matchedExistingOption.id },
                    data: {
                        name: cleanOptionName,
                        priceModifier: new client_1.Prisma.Decimal(option.priceModifier ?? 0),
                        sortOrder: option.sortOrder ?? optionIndex,
                        active: option.active ?? true,
                        costMode: option.costMode ?? "simple",
                        simpleCost: option.costMode === "recipe" || option.simpleCost == null
                            ? null
                            : new client_1.Prisma.Decimal(option.simpleCost),
                        stockUnit: option.stockUnit ?? null,
                        referenceQuantity: option.costMode === "recipe" || option.referenceQuantity == null
                            ? null
                            : new client_1.Prisma.Decimal(option.referenceQuantity),
                        referenceCost: option.costMode === "recipe" || option.referenceCost == null
                            ? null
                            : new client_1.Prisma.Decimal(option.referenceCost),
                        environmentPrices: {
                            deleteMany: {},
                            create: (option.environmentPrices ?? []).map((item) => ({
                                salesEnvironmentId: item.salesEnvironmentId,
                                priceModifier: new client_1.Prisma.Decimal(item.priceModifier),
                            })),
                        },
                        recipeItems: {
                            deleteMany: {},
                            create: (option.costMode ?? "simple") === "recipe"
                                ? (option.recipeItems ?? []).map((item) => ({
                                    ingredientProductId: item.ingredientProductId,
                                    quantity: new client_1.Prisma.Decimal(item.quantity),
                                    unit: item.unit,
                                }))
                                : [],
                        },
                    },
                });
            }
            else {
                await tx.productVariationOption.create({
                    data: {
                        groupId: savedGroup.id,
                        name: cleanOptionName,
                        priceModifier: new client_1.Prisma.Decimal(option.priceModifier ?? 0),
                        sortOrder: option.sortOrder ?? optionIndex,
                        active: option.active ?? true,
                        costMode: option.costMode ?? "simple",
                        simpleCost: option.costMode === "recipe" || option.simpleCost == null
                            ? null
                            : new client_1.Prisma.Decimal(option.simpleCost),
                        stockUnit: option.stockUnit ?? null,
                        referenceQuantity: option.costMode === "recipe" || option.referenceQuantity == null
                            ? null
                            : new client_1.Prisma.Decimal(option.referenceQuantity),
                        referenceCost: option.costMode === "recipe" || option.referenceCost == null
                            ? null
                            : new client_1.Prisma.Decimal(option.referenceCost),
                        environmentPrices: {
                            create: (option.environmentPrices ?? []).map((item) => ({
                                salesEnvironmentId: item.salesEnvironmentId,
                                priceModifier: new client_1.Prisma.Decimal(item.priceModifier),
                            })),
                        },
                        recipeItems: {
                            create: (option.costMode ?? "simple") === "recipe"
                                ? (option.recipeItems ?? []).map((item) => ({
                                    ingredientProductId: item.ingredientProductId,
                                    quantity: new client_1.Prisma.Decimal(item.quantity),
                                    unit: item.unit,
                                }))
                                : [],
                        },
                    },
                });
            }
        }
    }
}
async function updateProduct(productId, companyId, data, userId) {
    const existingProduct = await prisma_1.prisma.product.findFirst({
        where: {
            id: productId,
            companyId,
            deletedAt: null,
        },
        include: productInclude,
    });
    if (!existingProduct) {
        throw new Error("PRODUCT_NOT_FOUND");
    }
    if (data.categoryId !== undefined) {
        if (!data.categoryId) {
            throw new Error("CATEGORY_REQUIRED");
        }
        await ensureCategoryBelongsToCompany(data.categoryId, companyId);
    }
    await ensureRecipeIngredientsBelongToCompany(data.recipeItems, companyId, productId);
    await ensureVariationOptionIngredientsBelongToCompany(data.variationGroups, companyId, productId);
    validateRecipeOutput(data);
    if (data.costMode === "recipe" && data.recipeItems?.length) {
        await validateRecipeCycle(companyId, productId, data.recipeItems);
    }
    const resolvedCategoryId = data.categoryId === undefined
        ? existingProduct.categoryId
        : data.categoryId;
    if (!resolvedCategoryId) {
        throw new Error("CATEGORY_REQUIRED");
    }
    const product = await prisma_1.prisma.$transaction(async (tx) => {
        if (data.recipeItems) {
            await tx.productRecipeItem.deleteMany({
                where: {
                    productId,
                },
            });
        }
        const updated = await tx.product.update({
            where: {
                id: productId,
            },
            data: {
                category: {
                    connect: {
                        id: resolvedCategoryId,
                    },
                },
                name: data.name ?? existingProduct.name,
                description: data.description === undefined
                    ? existingProduct.description
                    : data.description,
                emoji: data.emoji === undefined ? existingProduct.emoji : data.emoji,
                price: data.price === undefined
                    ? existingProduct.price
                    : new client_1.Prisma.Decimal(data.price),
                active: data.active ?? existingProduct.active,
                isStockOnly: data.isStockOnly ?? existingProduct.isStockOnly,
                trackStock: data.trackStock ?? existingProduct.trackStock,
                stockQuantity: data.stockQuantity === undefined
                    ? existingProduct.stockQuantity
                    : data.stockQuantity,
                minStock: data.minStock === undefined
                    ? existingProduct.minStock
                    : data.minStock,
                costMode: data.costMode ?? existingProduct.costMode,
                simpleCost: data.simpleCost === undefined
                    ? existingProduct.simpleCost
                    : data.simpleCost == null
                        ? null
                        : new client_1.Prisma.Decimal(data.simpleCost),
                stockUnit: data.stockUnit === undefined
                    ? existingProduct.stockUnit
                    : data.stockUnit,
                referenceQuantity: data.referenceQuantity === undefined
                    ? existingProduct.referenceQuantity
                    : data.referenceQuantity == null
                        ? null
                        : new client_1.Prisma.Decimal(data.referenceQuantity),
                referenceCost: data.referenceCost === undefined
                    ? existingProduct.referenceCost
                    : data.referenceCost == null
                        ? null
                        : new client_1.Prisma.Decimal(data.referenceCost),
                unitContentQuantity: data.unitContentQuantity === undefined
                    ? existingProduct.unitContentQuantity
                    : data.unitContentQuantity == null
                        ? null
                        : new client_1.Prisma.Decimal(data.unitContentQuantity),
                unitContentUnit: data.unitContentUnit === undefined
                    ? existingProduct.unitContentUnit
                    : data.unitContentUnit,
                madeOnDemand: data.madeOnDemand === undefined
                    ? existingProduct.madeOnDemand
                    : data.madeOnDemand,
                unlimitedStock: data.unlimitedStock === undefined
                    ? existingProduct.unlimitedStock
                    : data.unlimitedStock,
                recipeOutputQuantity: data.recipeOutputQuantity === undefined
                    ? existingProduct.recipeOutputQuantity
                    : data.recipeOutputQuantity == null
                        ? null
                        : new client_1.Prisma.Decimal(data.recipeOutputQuantity),
                recipeOutputUnit: data.recipeOutputUnit === undefined
                    ? existingProduct.recipeOutputUnit
                    : data.recipeOutputUnit,
                ...(data.printPortId !== undefined
                    ? {
                        printPort: data.printPortId
                            ? { connect: { id: data.printPortId } }
                            : { disconnect: true },
                    }
                    : {}),
                ...(data.recipeItems
                    ? {
                        recipeItems: {
                            create: data.recipeItems.map((item) => ({
                                ingredientProductId: item.ingredientProductId,
                                quantity: new client_1.Prisma.Decimal(item.quantity),
                                unit: item.unit,
                            })),
                        },
                    }
                    : {}),
                ...(data.environmentPrices || data.isStockOnly !== undefined
                    ? {
                        environmentPrices: {
                            deleteMany: {},
                            create: ((data.isStockOnly ?? existingProduct.isStockOnly)
                                ? []
                                : (data.environmentPrices ?? [])).map((item) => ({
                                salesEnvironmentId: item.salesEnvironmentId,
                                price: new client_1.Prisma.Decimal(item.price),
                            })),
                        },
                    }
                    : {}),
            },
        });
        if (data.variationGroups !== undefined) {
            await syncProductVariationGroups({
                tx,
                productId,
                variationGroups: data.variationGroups ?? [],
            });
        }
        const updatedForAudit = await tx.product.findUnique({
            where: {
                id: productId,
            },
            include: productInclude,
        });
        if (!updatedForAudit) {
            throw new Error("PRODUCT_NOT_FOUND");
        }
        await (0, audit_service_1.createAuditLog)(tx, {
            companyId,
            userId,
            entityType: "Product",
            entityId: productId,
            action: "PRODUCT_UPDATED",
            description: "Produto atualizado: " + updatedForAudit.name,
            oldValues: productAuditSnapshot(existingProduct),
            newValues: productAuditSnapshot(updatedForAudit),
            metadata: {
                changedFields: Object.keys(data),
            },
        });
        if (hasCostRelevantInput(data) &&
            hasActualCostChange(existingProduct, updatedForAudit)) {
            await (0, product_cost_history_service_1.createProductCostHistoryEntry)({
                tx,
                companyId,
                productId,
                source: "product_edit",
                reason: "Custo alterado no cadastro do produto",
                oldProduct: pickProductCostHistorySnapshot(existingProduct),
                newProduct: pickProductCostHistorySnapshot(updatedForAudit),
                createdByUserId: userId,
                metadata: {
                    action: "PRODUCT_UPDATED",
                    changedFields: Object.keys(data),
                    oldCostSnapshot: productCostAuditSnapshot(existingProduct),
                    newCostSnapshot: productCostAuditSnapshot(updatedForAudit),
                },
            });
        }
        return updatedForAudit;
    });
    if (!product) {
        throw new Error("PRODUCT_NOT_FOUND");
    }
    return normalizeProduct(product);
}
async function deleteProduct(productId, companyId, userId) {
    const existingProduct = await prisma_1.prisma.product.findFirst({
        where: {
            id: productId,
            companyId,
            deletedAt: null,
        },
    });
    if (!existingProduct) {
        throw new Error("PRODUCT_NOT_FOUND");
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.product.update({
            where: { id: productId },
            data: {
                active: false,
                deletedAt: new Date(),
                deletedByUserId: userId,
                updatedByUserId: userId,
            },
        });
        await (0, audit_service_1.createAuditLog)(tx, {
            companyId,
            userId,
            entityType: "Product",
            entityId: productId,
            action: "PRODUCT_DELETED",
            oldValues: {
                name: existingProduct.name,
                active: existingProduct.active,
            },
            newValues: {
                active: false,
            },
        });
    });
    return { ok: true };
}
