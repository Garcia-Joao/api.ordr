import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { createAuditLog } from "./audit.service";
import { createProductCostHistoryEntry } from "./product-cost-history.service";

type ProductEnvironmentPriceInput = {
  salesEnvironmentId: string;
  price: number;
};

type VariationOptionEnvironmentPriceInput = {
  salesEnvironmentId: string;
  priceModifier: number;
};

type RecipeItemInput = {
  ingredientProductId: string;
  quantity: number;
  unit: "unit" | "ml" | "l" | "g" | "kg";
};

type VariationOptionInput = {
  id?: string;
  name: string;
  priceModifier?: number;
  sortOrder?: number;
  active?: boolean;

  costMode?: "simple" | "recipe";
  simpleCost?: number | null;
  stockUnit?: "unit" | "ml" | "l" | "g" | "kg" | null;
  referenceQuantity?: number | null;
  referenceCost?: number | null;

  environmentPrices?: VariationOptionEnvironmentPriceInput[];
  recipeItems?: RecipeItemInput[];
};

type VariationGroupInput = {
  id?: string;
  name: string;
  selectionType: "single" | "multiple";
  required?: boolean;
  sortOrder?: number;
  options?: VariationOptionInput[];
};

type CreateProductInput = {
  companyId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
  price: number;
  active?: boolean;
  isStockOnly?: boolean;
  trackStock?: boolean;
  stockQuantity?: number;
  minStock?: number;
  variationGroups?: VariationGroupInput[];
  environmentPrices?: ProductEnvironmentPriceInput[];
  costMode?: "simple" | "recipe";
  simpleCost?: number | null;
  stockUnit?: "unit" | "ml" | "l" | "g" | "kg" | null;
  referenceQuantity?: number | null;
  referenceCost?: number | null;
  unitContentQuantity?: number | null;
  unitContentUnit?: "ml" | "l" | "g" | "kg" | null;
  madeOnDemand?: boolean;
  unlimitedStock?: boolean;
  recipeOutputQuantity?: number | null;
  recipeOutputUnit?: "unit" | "ml" | "l" | "g" | "kg" | null;
  recipeItems?: RecipeItemInput[];
};

type UpdateProductInput = {
  categoryId?: string | null;
  name?: string;
  description?: string | null;
  emoji?: string | null;
  price?: number;
  active?: boolean;
  isStockOnly?: boolean;
  trackStock?: boolean;
  stockQuantity?: number;
  minStock?: number;
  variationGroups?: VariationGroupInput[];
  environmentPrices?: ProductEnvironmentPriceInput[];
  costMode?: "simple" | "recipe";
  simpleCost?: number | null;
  stockUnit?: "unit" | "ml" | "l" | "g" | "kg" | null;
  referenceQuantity?: number | null;
  referenceCost?: number | null;
  unitContentQuantity?: number | null;
  unitContentUnit?: "ml" | "l" | "g" | "kg" | null;
  madeOnDemand?: boolean;
  unlimitedStock?: boolean;
  recipeOutputQuantity?: number | null;
  recipeOutputUnit?: "unit" | "ml" | "l" | "g" | "kg" | null;
  recipeItems?: RecipeItemInput[];
};

function convertToBaseUnit(quantity: number, unit: string): number {
  switch (unit) {
    case "l":
      return quantity * 1000;
    case "kg":
      return quantity * 1000;
    default:
      return quantity;
  }
}

function decimalAuditValue(value: any) {
  if (value === null || typeof value === "undefined") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function recipeItemsAuditSnapshot(items: any[] | undefined) {
  return (items ?? [])
    .map((item: any) => ({
      // Do not store the RecipeItem row id in the audit snapshot.
      // Recipe rows can be deleted/recreated during product saves even when the
      // logical recipe did not change, and including the row id creates false
      // variation/recipe changes in the audit screen.
      ingredientProductId: item.ingredientProductId,
      ingredientProductName:
        item.ingredientProduct?.name ?? item.ingredientProductName ?? null,
      ingredientProductEmoji: item.ingredientProduct?.emoji ?? null,
      categoryName: item.ingredientProduct?.category?.name ?? null,
      quantity: decimalAuditValue(item.quantity),
      unit: item.unit,
    }))
    .sort((a: any, b: any) =>
      String(
        a.ingredientProductName ?? a.ingredientProductId ?? "",
      ).localeCompare(
        String(b.ingredientProductName ?? b.ingredientProductId ?? ""),
      ),
    );
}

function variationGroupsAuditSnapshot(product: any) {
  return (product.variationGroups ?? []).map((group: any) => ({
    id: group.id,
    name: group.name,
    required: Boolean(group.required),
    selectionType: group.selectionType,
    sortOrder: Number(group.sortOrder ?? 0),
    options: (group.options ?? []).map((option: any) => ({
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
        .map((item: any) => ({
          salesEnvironmentId: item.salesEnvironmentId,
          salesEnvironmentName: item.salesEnvironment?.name ?? null,
          priceModifier: decimalAuditValue(item.priceModifier),
        }))
        .sort((a: any, b: any) =>
          String(a.salesEnvironmentName ?? a.salesEnvironmentId ?? "").localeCompare(
            String(b.salesEnvironmentName ?? b.salesEnvironmentId ?? ""),
          ),
        ),
      recipeItems: recipeItemsAuditSnapshot(option.recipeItems),
    })).sort((a: any, b: any) =>
      String(a.name ?? a.id ?? "").localeCompare(String(b.name ?? b.id ?? "")),
    ),
  })).sort((a: any, b: any) =>
    String(a.name ?? a.id ?? "").localeCompare(String(b.name ?? b.id ?? "")),
  );
}

function productCostAuditSnapshot(product: any) {
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
    variationGroups: variationGroupsAuditSnapshot(product).map(
      (group: any) => ({
        id: group.id,
        options: group.options.map((option: any) => ({
          id: option.id,
          costMode: option.costMode,
          simpleCost: option.simpleCost,
          stockUnit: option.stockUnit,
          referenceQuantity: option.referenceQuantity,
          referenceCost: option.referenceCost,
          recipeItems: option.recipeItems,
        })),
      }),
    ),
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function hasActualCostChange(oldProduct: any, newProduct: any) {
  return (
    stableStringify(productCostAuditSnapshot(oldProduct)) !==
    stableStringify(productCostAuditSnapshot(newProduct))
  );
}

function productAuditSnapshot(product: any) {
  return {
    name: product.name,
    description: product.description ?? null,
    emoji: product.emoji ?? null,
    categoryId: product.categoryId,
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

function normalizeProduct(product: any) {
  const normalizedRecipeItems = (product.recipeItems ?? []).map((item: any) => {
    const ingredient = item.ingredientProduct;
    const referenceQuantity = Number(ingredient?.referenceQuantity ?? 0);
    const referenceCost = Number(ingredient?.referenceCost ?? 0);

    const ingredientBaseReference =
      referenceQuantity > 0
        ? convertToBaseUnit(
            referenceQuantity,
            ingredient?.stockUnit ?? item.unit,
          )
        : 0;

    const recipeBaseQuantity = convertToBaseUnit(
      Number(item.quantity),
      item.unit,
    );

    const computedCost =
      ingredientBaseReference > 0
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
            simpleCost:
              ingredient.simpleCost == null
                ? null
                : Number(ingredient.simpleCost),
            referenceQuantity:
              ingredient.referenceQuantity == null
                ? null
                : Number(ingredient.referenceQuantity),
            referenceCost:
              ingredient.referenceCost == null
                ? null
                : Number(ingredient.referenceCost),
            unitContentQuantity:
              ingredient.unitContentQuantity == null
                ? null
                : Number(ingredient.unitContentQuantity),
            unitContentUnit: ingredient.unitContentUnit ?? null,
            recipeOutputQuantity:
              ingredient.recipeOutputQuantity == null
                ? null
                : Number(ingredient.recipeOutputQuantity),
            recipeOutputUnit: ingredient.recipeOutputUnit ?? null,
            madeOnDemand: Boolean(ingredient.madeOnDemand),
            unlimitedStock: Boolean(ingredient.unlimitedStock),
          }
        : null,
    };
  });

  const recipeCost = normalizedRecipeItems.reduce(
    (sum: number, item: any) => sum + Number(item.computedCost ?? 0),
    0,
  );

  return {
    ...product,
    price: Number(product.price),
    simpleCost: product.simpleCost == null ? null : Number(product.simpleCost),
    referenceQuantity:
      product.referenceQuantity == null
        ? null
        : Number(product.referenceQuantity),
    referenceCost:
      product.referenceCost == null ? null : Number(product.referenceCost),
    unitContentQuantity:
      product.unitContentQuantity == null
        ? null
        : Number(product.unitContentQuantity),
    unitContentUnit: product.unitContentUnit ?? null,
    recipeOutputQuantity:
      product.recipeOutputQuantity == null
        ? null
        : Number(product.recipeOutputQuantity),
    recipeOutputUnit: product.recipeOutputUnit ?? null,
    madeOnDemand: Boolean(product.madeOnDemand),
    unlimitedStock: Boolean(product.unlimitedStock),
    recipeCost,
    recipeItems: normalizedRecipeItems,
    environmentPrices: (product.environmentPrices ?? []).map((item: any) => ({
      ...item,
      price: Number(item.price),
    })),
    variationGroups: (product.variationGroups ?? [])
      .filter((group: any) => (group.options ?? []).length > 0)
      .map((group: any) => ({
        ...group,
        options: (group.options ?? []).map((option: any) => {
          const normalizedOptionRecipeItems = (option.recipeItems ?? []).map(
            (item: any) => {
              const ingredient = item.ingredientProduct;
              const referenceQuantity = Number(
                ingredient?.referenceQuantity ?? 0,
              );
              const referenceCost = Number(ingredient?.referenceCost ?? 0);

              const ingredientBaseReference =
                referenceQuantity > 0
                  ? convertToBaseUnit(
                      referenceQuantity,
                      ingredient?.stockUnit ?? item.unit,
                    )
                  : 0;

              const recipeBaseQuantity = convertToBaseUnit(
                Number(item.quantity),
                item.unit,
              );

              const computedCost =
                ingredientBaseReference > 0
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
                      simpleCost:
                        ingredient.simpleCost == null
                          ? null
                          : Number(ingredient.simpleCost),
                      referenceQuantity:
                        ingredient.referenceQuantity == null
                          ? null
                          : Number(ingredient.referenceQuantity),
                      referenceCost:
                        ingredient.referenceCost == null
                          ? null
                          : Number(ingredient.referenceCost),
                      unitContentQuantity:
                        ingredient.unitContentQuantity == null
                          ? null
                          : Number(ingredient.unitContentQuantity),
                      unitContentUnit: ingredient.unitContentUnit ?? null,
                    }
                  : null,
              };
            },
          );

          const recipeCost = normalizedOptionRecipeItems.reduce(
            (sum: number, item: any) => sum + Number(item.computedCost ?? 0),
            0,
          );

          return {
            ...option,
            priceModifier: Number(option.priceModifier),
            costMode: option.costMode ?? "simple",
            simpleCost:
              option.simpleCost == null ? null : Number(option.simpleCost),
            stockUnit: option.stockUnit ?? null,
            referenceQuantity:
              option.referenceQuantity == null
                ? null
                : Number(option.referenceQuantity),
            referenceCost:
              option.referenceCost == null
                ? null
                : Number(option.referenceCost),
            recipeCost,
            recipeItems: normalizedOptionRecipeItems,
            environmentPrices: (option.environmentPrices ?? []).map(
              (item: any) => ({
                ...item,
                priceModifier: Number(item.priceModifier),
              }),
            ),
          };
        }),
      }))
      .filter((group: any) => (group.options ?? []).length > 0),
  };
}

function validateRecipeOutput(data: {
  costMode?: "simple" | "recipe";
  recipeItems?: RecipeItemInput[];
  recipeOutputQuantity?: number | null;
  recipeOutputUnit?: string | null;
}) {
  if (data.costMode !== "recipe") return;

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

function pickProductCostHistorySnapshot(product: any) {
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

type CostRelevantInput = {
  categoryId?: string | null;
  costMode?: "simple" | "recipe";
  simpleCost?: number | null;
  stockUnit?: "unit" | "ml" | "l" | "g" | "kg" | null;
  referenceQuantity?: number | null;
  referenceCost?: number | null;
  unitContentQuantity?: number | null;
  unitContentUnit?: "ml" | "l" | "g" | "kg" | null;
  recipeOutputQuantity?: number | null;
  recipeOutputUnit?: "unit" | "ml" | "l" | "g" | "kg" | null;
  recipeItems?: RecipeItemInput[];
};

function hasCostRelevantInput(data: CostRelevantInput) {
  const fields: Array<keyof CostRelevantInput> = [
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

  return fields.some((field) =>
    Object.prototype.hasOwnProperty.call(data, field),
  );
}

async function ensureCategoryBelongsToCompany(
  categoryId: string,
  companyId: string,
) {
  const category = await prisma.category.findFirst({
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

async function ensureRecipeIngredientsBelongToCompany(
  recipeItems: RecipeItemInput[] | undefined,
  companyId: string,
  currentProductId?: string,
) {
  if (!recipeItems?.length) return;

  for (const item of recipeItems) {
    if (!item.ingredientProductId) {
      throw new Error("RECIPE_INGREDIENT_REQUIRED");
    }

    if (currentProductId && item.ingredientProductId === currentProductId) {
      throw new Error("RECIPE_INGREDIENT_CANNOT_BE_SELF");
    }

    const ingredient = await prisma.product.findFirst({
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

async function validateRecipeCycle(
  companyId: string,
  productId: string,
  recipeItems: RecipeItemInput[],
  visited: string[] = [],
) {
  for (const item of recipeItems) {
    const ingredientId = item.ingredientProductId;
    if (!ingredientId) continue;

    if (ingredientId === productId || visited.includes(ingredientId)) {
      throw new Error("RECIPE_CYCLE_DETECTED");
    }

    const ingredient = await prisma.product.findFirst({
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

    if (!ingredient || !ingredient.recipeItems.length) continue;

    await validateRecipeCycle(
      companyId,
      productId,
      ingredient.recipeItems.map((recipeItem) => ({
        ingredientProductId: recipeItem.ingredientProductId,
        quantity: Number(recipeItem.quantity),
        unit: recipeItem.unit as RecipeItemInput["unit"],
      })),
      [...visited, ingredientId],
    );
  }
}

const productInclude = {
  category: true,
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
      createdAt: "asc" as const,
    },
  },
  variationGroups: {
    orderBy: {
      sortOrder: "asc" as const,
    },
    include: {
      options: {
        where: {
          active: true,
        },
        orderBy: {
          sortOrder: "asc" as const,
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
              createdAt: "asc" as const,
            },
          },
        },
      },
    },
  },
};

async function ensureVariationOptionIngredientsBelongToCompany(
  variationGroups: VariationGroupInput[] | undefined,
  companyId: string,
  currentProductId?: string,
) {
  if (!variationGroups?.length) return;

  for (const group of variationGroups) {
    for (const option of group.options ?? []) {
      for (const item of option.recipeItems ?? []) {
        if (!item.ingredientProductId) {
          throw new Error("VARIATION_RECIPE_INGREDIENT_REQUIRED");
        }

        if (currentProductId && item.ingredientProductId === currentProductId) {
          throw new Error("VARIATION_RECIPE_INGREDIENT_CANNOT_BE_SELF");
        }

        const ingredient = await prisma.product.findFirst({
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

export async function getProductsByCompany(
  companyId: string,
  includeInactive = false,
) {
  const products = await prisma.product.findMany({
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

  return products.map(normalizeProduct);
}

export async function getProductById(productId: string, companyId: string) {
  const product = await prisma.product.findFirst({
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

export async function createProduct(data: CreateProductInput, userId: string) {
  if (!data.categoryId) {
    throw new Error("CATEGORY_REQUIRED");
  }

  await ensureCategoryBelongsToCompany(data.categoryId, data.companyId);
  await ensureRecipeIngredientsBelongToCompany(
    data.recipeItems,
    data.companyId,
  );
  await ensureVariationOptionIngredientsBelongToCompany(
    data.variationGroups,
    data.companyId,
  );
  validateRecipeOutput(data);

  if (data.costMode === "recipe" && data.recipeItems?.length) {
    await validateRecipeCycle(data.companyId, "__new__", data.recipeItems);
  }

  const createPayload = {
    categoryId: data.categoryId,
    name: data.name,
    description: data.description ?? null,
    emoji: data.emoji ?? null,
    price: new Prisma.Decimal(data.price ?? 0),
    active: data.active ?? true,
    isStockOnly: data.isStockOnly ?? false,
    trackStock: data.trackStock ?? false,
    stockQuantity: data.stockQuantity ?? 0,
    minStock: data.minStock ?? 0,
    costMode: data.costMode ?? "simple",
    simpleCost:
      data.simpleCost == null ? null : new Prisma.Decimal(data.simpleCost),
    stockUnit: data.stockUnit ?? null,
    referenceQuantity:
      data.referenceQuantity == null
        ? null
        : new Prisma.Decimal(data.referenceQuantity),
    referenceCost:
      data.referenceCost == null
        ? null
        : new Prisma.Decimal(data.referenceCost),
    unitContentQuantity:
      data.unitContentQuantity == null
        ? null
        : new Prisma.Decimal(data.unitContentQuantity),
    unitContentUnit: data.unitContentUnit ?? null,
    madeOnDemand: data.madeOnDemand ?? false,
    unlimitedStock: data.unlimitedStock ?? false,
    recipeOutputQuantity:
      data.recipeOutputQuantity == null
        ? null
        : new Prisma.Decimal(data.recipeOutputQuantity),
    recipeOutputUnit: data.recipeOutputUnit ?? null,
    recipeItems: {
      create: (data.recipeItems ?? []).map((item) => ({
        ingredientProductId: item.ingredientProductId,
        quantity: new Prisma.Decimal(item.quantity),
        unit: item.unit,
      })),
    },
    environmentPrices: {
      create: (data.isStockOnly ? [] : (data.environmentPrices ?? [])).map(
        (item) => ({
          salesEnvironmentId: item.salesEnvironmentId,
          price: new Prisma.Decimal(item.price),
        }),
      ),
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
            priceModifier: new Prisma.Decimal(option.priceModifier ?? 0),
            sortOrder: option.sortOrder ?? optionIndex,
            active: option.active ?? true,
            costMode: option.costMode ?? "simple",
            simpleCost:
              option.costMode === "recipe" || option.simpleCost == null
                ? null
                : new Prisma.Decimal(option.simpleCost),
            stockUnit: option.stockUnit ?? null,
            referenceQuantity:
              option.costMode === "recipe" || option.referenceQuantity == null
                ? null
                : new Prisma.Decimal(option.referenceQuantity),
            referenceCost:
              option.costMode === "recipe" || option.referenceCost == null
                ? null
                : new Prisma.Decimal(option.referenceCost),
            environmentPrices: {
              create: (option.environmentPrices ?? []).map((item) => ({
                salesEnvironmentId: item.salesEnvironmentId,
                priceModifier: new Prisma.Decimal(item.priceModifier),
              })),
            },
            recipeItems: {
              create: (option.recipeItems ?? []).map((item) => ({
                ingredientProductId: item.ingredientProductId,
                quantity: new Prisma.Decimal(item.quantity),
                unit: item.unit,
              })),
            },
          })),
        },
      })),
    },
  };

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        companyId: data.companyId,
        createdByUserId: userId,
        updatedByUserId: userId,
        ...createPayload,
      },
      include: productInclude,
    });

    await createAuditLog(tx, {
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
      await createProductCostHistoryEntry({
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

async function syncProductVariationGroups(params: {
  tx: any;
  productId: string;
  variationGroups: VariationGroupInput[];
}) {
  const { tx, productId, variationGroups } = params;

  function normalizeName(value: string) {
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

  const incomingGroupKeys = new Set(
    variationGroups.map((group) =>
      group.id ? `id:${group.id}` : `name:${normalizeName(group.name)}`,
    ),
  );

  const removedGroups = existingGroups.filter((group: any) => {
    const idKey = `id:${group.id}`;
    const nameKey = `name:${normalizeName(group.name)}`;
    return !incomingGroupKeys.has(idKey) && !incomingGroupKeys.has(nameKey);
  });

  for (const group of removedGroups) {
    const groupWasUsed =
      group.itemSelections.length > 0 ||
      group.options.some((option: any) => option.selectedInItems.length > 0);

    if (groupWasUsed) {
      await tx.productVariationOption.updateMany({
        where: { groupId: group.id },
        data: { active: false },
      });
    } else {
      await tx.productVariationGroup.delete({
        where: { id: group.id },
      });
    }
  }

  for (const [groupIndex, group] of variationGroups.entries()) {
    const cleanGroupName = group.name.trim();

    const matchedExistingGroup = group.id
      ? existingGroups.find(
          (existingGroup: any) => existingGroup.id === group.id,
        )
      : existingGroups.find(
          (existingGroup: any) =>
            normalizeName(existingGroup.name) === normalizeName(cleanGroupName),
        );

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

    const incomingOptionKeys = new Set(
      incomingOptions.map((option) =>
        option.id ? `id:${option.id}` : `name:${normalizeName(option.name)}`,
      ),
    );

    const removedOptions = existingOptions.filter((option: any) => {
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
      } else {
        await tx.productVariationOption.delete({
          where: { id: option.id },
        });
      }
    }

    for (const [optionIndex, option] of incomingOptions.entries()) {
      const cleanOptionName = option.name.trim();

      const matchedExistingOption = option.id
        ? existingOptions.find(
            (existingOption: any) => existingOption.id === option.id,
          )
        : existingOptions.find(
            (existingOption: any) =>
              normalizeName(existingOption.name) ===
              normalizeName(cleanOptionName),
          );

      if (matchedExistingOption) {
        await tx.productVariationOption.update({
          where: { id: matchedExistingOption.id },
          data: {
            name: cleanOptionName,
            priceModifier: new Prisma.Decimal(option.priceModifier ?? 0),
            sortOrder: option.sortOrder ?? optionIndex,
            active: option.active ?? true,
            costMode: option.costMode ?? "simple",
            simpleCost:
              option.costMode === "recipe" || option.simpleCost == null
                ? null
                : new Prisma.Decimal(option.simpleCost),
            stockUnit: option.stockUnit ?? null,
            referenceQuantity:
              option.costMode === "recipe" || option.referenceQuantity == null
                ? null
                : new Prisma.Decimal(option.referenceQuantity),
            referenceCost:
              option.costMode === "recipe" || option.referenceCost == null
                ? null
                : new Prisma.Decimal(option.referenceCost),
            environmentPrices: {
              deleteMany: {},
              create: (option.environmentPrices ?? []).map((item) => ({
                salesEnvironmentId: item.salesEnvironmentId,
                priceModifier: new Prisma.Decimal(item.priceModifier),
              })),
            },
            recipeItems: {
              deleteMany: {},
              create:
                (option.costMode ?? "simple") === "recipe"
                  ? (option.recipeItems ?? []).map((item) => ({
                      ingredientProductId: item.ingredientProductId,
                      quantity: new Prisma.Decimal(item.quantity),
                      unit: item.unit,
                    }))
                  : [],
            },
          },
        });
      } else {
        await tx.productVariationOption.create({
          data: {
            groupId: savedGroup.id,
            name: cleanOptionName,
            priceModifier: new Prisma.Decimal(option.priceModifier ?? 0),
            sortOrder: option.sortOrder ?? optionIndex,
            active: option.active ?? true,
            costMode: option.costMode ?? "simple",
            simpleCost:
              option.costMode === "recipe" || option.simpleCost == null
                ? null
                : new Prisma.Decimal(option.simpleCost),
            stockUnit: option.stockUnit ?? null,
            referenceQuantity:
              option.costMode === "recipe" || option.referenceQuantity == null
                ? null
                : new Prisma.Decimal(option.referenceQuantity),
            referenceCost:
              option.costMode === "recipe" || option.referenceCost == null
                ? null
                : new Prisma.Decimal(option.referenceCost),
            environmentPrices: {
              create: (option.environmentPrices ?? []).map((item) => ({
                salesEnvironmentId: item.salesEnvironmentId,
                priceModifier: new Prisma.Decimal(item.priceModifier),
              })),
            },
            recipeItems: {
              create:
                (option.costMode ?? "simple") === "recipe"
                  ? (option.recipeItems ?? []).map((item) => ({
                      ingredientProductId: item.ingredientProductId,
                      quantity: new Prisma.Decimal(item.quantity),
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

export async function updateProduct(
  productId: string,
  companyId: string,
  data: UpdateProductInput,
  userId: string,
) {
  const existingProduct = await prisma.product.findFirst({
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

  await ensureRecipeIngredientsBelongToCompany(
    data.recipeItems,
    companyId,
    productId,
  );
  await ensureVariationOptionIngredientsBelongToCompany(
    data.variationGroups,
    companyId,
    productId,
  );
  validateRecipeOutput(data);

  if (data.costMode === "recipe" && data.recipeItems?.length) {
    await validateRecipeCycle(companyId, productId, data.recipeItems);
  }

  const resolvedCategoryId =
    data.categoryId === undefined
      ? existingProduct.categoryId
      : data.categoryId;

  if (!resolvedCategoryId) {
    throw new Error("CATEGORY_REQUIRED");
  }

  const product = await prisma.$transaction(async (tx) => {
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
        description:
          data.description === undefined
            ? existingProduct.description
            : data.description,
        emoji: data.emoji === undefined ? existingProduct.emoji : data.emoji,
        price:
          data.price === undefined
            ? existingProduct.price
            : new Prisma.Decimal(data.price),
        active: data.active ?? existingProduct.active,
        isStockOnly: data.isStockOnly ?? existingProduct.isStockOnly,
        trackStock: data.trackStock ?? existingProduct.trackStock,
        stockQuantity:
          data.stockQuantity === undefined
            ? existingProduct.stockQuantity
            : data.stockQuantity,
        minStock:
          data.minStock === undefined
            ? existingProduct.minStock
            : data.minStock,
        costMode: data.costMode ?? existingProduct.costMode,
        simpleCost:
          data.simpleCost === undefined
            ? existingProduct.simpleCost
            : data.simpleCost == null
              ? null
              : new Prisma.Decimal(data.simpleCost),
        stockUnit:
          data.stockUnit === undefined
            ? existingProduct.stockUnit
            : data.stockUnit,
        referenceQuantity:
          data.referenceQuantity === undefined
            ? existingProduct.referenceQuantity
            : data.referenceQuantity == null
              ? null
              : new Prisma.Decimal(data.referenceQuantity),
        referenceCost:
          data.referenceCost === undefined
            ? existingProduct.referenceCost
            : data.referenceCost == null
              ? null
              : new Prisma.Decimal(data.referenceCost),
        unitContentQuantity:
          data.unitContentQuantity === undefined
            ? existingProduct.unitContentQuantity
            : data.unitContentQuantity == null
              ? null
              : new Prisma.Decimal(data.unitContentQuantity),
        unitContentUnit:
          data.unitContentUnit === undefined
            ? existingProduct.unitContentUnit
            : data.unitContentUnit,
        madeOnDemand:
          data.madeOnDemand === undefined
            ? existingProduct.madeOnDemand
            : data.madeOnDemand,
        unlimitedStock:
          data.unlimitedStock === undefined
            ? existingProduct.unlimitedStock
            : data.unlimitedStock,
        recipeOutputQuantity:
          data.recipeOutputQuantity === undefined
            ? existingProduct.recipeOutputQuantity
            : data.recipeOutputQuantity == null
              ? null
              : new Prisma.Decimal(data.recipeOutputQuantity),
        recipeOutputUnit:
          data.recipeOutputUnit === undefined
            ? existingProduct.recipeOutputUnit
            : data.recipeOutputUnit,
        updatedByUser: {
          connect: {
            id: userId,
          },
        },

        ...(data.recipeItems
          ? {
              recipeItems: {
                create: data.recipeItems.map((item) => ({
                  ingredientProductId: item.ingredientProductId,
                  quantity: new Prisma.Decimal(item.quantity),
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
                  : (data.environmentPrices ?? [])
                ).map((item) => ({
                  salesEnvironmentId: item.salesEnvironmentId,
                  price: new Prisma.Decimal(item.price),
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

    await createAuditLog(tx, {
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

    if (
      hasCostRelevantInput(data) &&
      hasActualCostChange(existingProduct, updatedForAudit)
    ) {
      await createProductCostHistoryEntry({
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

export async function deleteProduct(
  productId: string,
  companyId: string,
  userId: string,
) {
  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      companyId,
      deletedAt: null,
    },
  });

  if (!existingProduct) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        active: false,
        deletedAt: new Date(),
        deletedByUserId: userId,
        updatedByUserId: userId,
      },
    });

    await createAuditLog(tx, {
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
