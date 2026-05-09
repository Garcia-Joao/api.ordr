import { prisma } from '../lib/prisma'

type StockMovementType = 'in' | 'out' | 'adjustment'
type StockUnit = 'unit' | 'ml' | 'l' | 'g' | 'kg'

type FlatRequirement = {
  ingredientProductId: string
  ingredientName: string
  ingredientEmoji?: string | null
  unit: StockUnit
  requiredQuantity: number
  stockAvailable: number
  possibleUnitsFromStock: number
  missingQuantity: number
  isRecipe?: boolean
  isUnlimited?: boolean
  stockUnit?: StockUnit
}

type RecipeNode = {
  productId: string
  productName: string
  requestedQuantity: number
  children: RecipeNode[]
}

const MAX_RECIPE_DEPTH = 25

function normalizeProduct(product: any) {
  return {
    ...product,
    price: Number(product.price),
    stockQuantity: product.stockQuantity == null ? 0 : Number(product.stockQuantity),
    minStock: product.minStock == null ? 0 : Number(product.minStock),
    simpleCost: product.simpleCost == null ? null : Number(product.simpleCost),
    referenceQuantity:
      product.referenceQuantity == null ? null : Number(product.referenceQuantity),
    referenceCost:
      product.referenceCost == null ? null : Number(product.referenceCost),
    unitContentQuantity:
      product.unitContentQuantity == null ? null : Number(product.unitContentQuantity),
    unitContentUnit: product.unitContentUnit ?? null,
    recipeOutputQuantity:
      product.recipeOutputQuantity == null ? null : Number(product.recipeOutputQuantity),
    recipeOutputUnit: product.recipeOutputUnit ?? null,
    madeOnDemand: Boolean(product.madeOnDemand),
    unlimitedStock: Boolean(product.unlimitedStock),
  }
}

function normalizeMovement(movement: any) {
  return {
    ...movement,
  }
}

function getUnitCategory(unit: StockUnit): 'count' | 'volume' | 'mass' {
  if (unit === 'unit') return 'count'
  if (unit === 'ml' || unit === 'l') return 'volume'
  return 'mass'
}

function toBaseUnit(quantity: number, unit: StockUnit): number {
  if (unit === 'l') return quantity * 1000
  if (unit === 'kg') return quantity * 1000
  return quantity
}

function fromBaseUnit(quantity: number, unit: StockUnit): number {
  if (unit === 'l') return quantity / 1000
  if (unit === 'kg') return quantity / 1000
  return quantity
}

function areUnitsCompatible(a: StockUnit, b: StockUnit): boolean {
  return getUnitCategory(a) === getUnitCategory(b)
}

function normalizeDisplayQuantity(
  quantity: number,
  unit: StockUnit
): { quantity: number; unit: StockUnit } {
  if (unit === 'kg' && quantity < 1) {
    return {
      quantity: Number((quantity * 1000).toFixed(3)),
      unit: 'g',
    }
  }

  if (unit === 'l' && quantity < 1) {
    return {
      quantity: Number((quantity * 1000).toFixed(3)),
      unit: 'ml',
    }
  }

  if (unit === 'g' && quantity >= 1000) {
    return {
      quantity: Number((quantity / 1000).toFixed(3)),
      unit: 'kg',
    }
  }

  if (unit === 'ml' && quantity >= 1000) {
    return {
      quantity: Number((quantity / 1000).toFixed(3)),
      unit: 'l',
    }
  }

  return {
    quantity: Number(quantity.toFixed(3)),
    unit,
  }
}

function getUnitContentQuantity(product: any): number | null {
  const quantity = Number(product?.unitContentQuantity ?? 0)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

function getUnitContentUnit(product: any): StockUnit | null {
  const unit = (product?.unitContentUnit ?? null) as StockUnit | null
  return unit && unit !== 'unit' ? unit : null
}

function hasUnitContent(product: any): boolean {
  return (
    (product?.stockUnit ?? 'unit') === 'unit' &&
    !!getUnitContentQuantity(product) &&
    !!getUnitContentUnit(product)
  )
}

function getEffectiveStockUnit(product: any, fallbackUnit: StockUnit): StockUnit {
  if (hasUnitContent(product)) {
    return getUnitContentUnit(product) ?? fallbackUnit
  }

  return (product?.stockUnit ?? fallbackUnit) as StockUnit
}

function getAvailableBaseQuantity(product: any, fallbackUnit: StockUnit): number {
  if (product?.unlimitedStock) return Number.POSITIVE_INFINITY

  const stockQuantity = Number(product?.stockQuantity ?? 0)
  if (!Number.isFinite(stockQuantity)) return stockQuantity

  if (hasUnitContent(product)) {
    const contentQuantity = getUnitContentQuantity(product) ?? 0
    const contentUnit = getUnitContentUnit(product) ?? fallbackUnit
    return toBaseUnit(stockQuantity * contentQuantity, contentUnit)
  }

  const stockUnit = (product?.stockUnit ?? fallbackUnit) as StockUnit
  return toBaseUnit(stockQuantity, stockUnit)
}

function getSimpleUnitCost(product: any): number {
  const referenceCost = Number(product.referenceCost ?? product.simpleCost ?? 0)
  if (!Number.isFinite(referenceCost) || referenceCost <= 0) return 0

  const rawReferenceQuantity = Number(product.referenceQuantity ?? 1)
  if (!Number.isFinite(rawReferenceQuantity) || rawReferenceQuantity <= 0) return 0

  /**
   * When stock is controlled as "unit" but each unit represents physical content,
   * referenceQuantity means how many stock units were bought for referenceCost.
   *
   * Example:
   * - stockUnit = unit
   * - unitContentQuantity = 910
   * - unitContentUnit = ml
   * - referenceQuantity = 1
   * - referenceCost = 16
   * => cost per ml = 16 / 910
   *
   * Compatibility fallback: older UI versions could store referenceQuantity as
   * the represented content amount itself, e.g. 910 instead of 1. If it equals
   * unitContentQuantity, treat it as content amount to avoid multiplying twice.
   */
  if (hasUnitContent(product)) {
    const contentUnit = getUnitContentUnit(product)
    const contentQuantity = getUnitContentQuantity(product)

    if (!contentUnit || !contentQuantity) return 0

    const looksLikeOldContentReference =
      Math.abs(rawReferenceQuantity - contentQuantity) < 0.000001

    const referenceContentQuantity = looksLikeOldContentReference
      ? rawReferenceQuantity
      : rawReferenceQuantity * contentQuantity

    const refBase = toBaseUnit(referenceContentQuantity, contentUnit)
    return refBase > 0 ? referenceCost / refBase : 0
  }

  const unit = (product.stockUnit ?? 'unit') as StockUnit
  const refBase = toBaseUnit(rawReferenceQuantity, unit)
  if (refBase <= 0) return 0

  return referenceCost / refBase
}

function buildFlatRequirement(params: {
  ingredient: any
  requiredQuantity: number
  requiredUnit: StockUnit
  ingredientIsRecipe?: boolean
}): FlatRequirement {
  const { ingredient, requiredQuantity, requiredUnit, ingredientIsRecipe = false } = params
  const effectiveStockUnit = getEffectiveStockUnit(ingredient, requiredUnit)

  if (!areUnitsCompatible(effectiveStockUnit, requiredUnit)) {
    throw new Error('RECIPE_UNIT_MISMATCH')
  }

  const requiredBase = toBaseUnit(requiredQuantity, requiredUnit)
  const stockBase = getAvailableBaseQuantity(ingredient, requiredUnit)

  const displayRequired = normalizeDisplayQuantity(
    fromBaseUnit(requiredBase, effectiveStockUnit),
    effectiveStockUnit
  )

  const stockAvailable =
    stockBase === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : normalizeDisplayQuantity(
          fromBaseUnit(stockBase, effectiveStockUnit),
          effectiveStockUnit
        ).quantity

  const missingQuantity =
    stockBase === Number.POSITIVE_INFINITY
      ? 0
      : normalizeDisplayQuantity(
          fromBaseUnit(Math.max(0, requiredBase - stockBase), effectiveStockUnit),
          effectiveStockUnit
        ).quantity

  return {
    ingredientProductId: ingredient.id,
    ingredientName: ingredient.name,
    ingredientEmoji: ingredient.emoji,
    unit: displayRequired.unit,
    requiredQuantity: displayRequired.quantity,
    stockAvailable,
    missingQuantity,
    possibleUnitsFromStock:
      requiredBase > 0 && stockBase !== Number.POSITIVE_INFINITY
        ? Number((stockBase / requiredBase).toFixed(3))
        : stockBase === Number.POSITIVE_INFINITY
          ? Number.POSITIVE_INFINITY
          : 0,
    isRecipe: ingredientIsRecipe,
    isUnlimited: Boolean(ingredient.unlimitedStock),
    stockUnit: displayRequired.unit,
  }
}

async function getProductForRecipe(companyId: string, productId: string) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      companyId,
      active: true,
    },
    include: {
      category: true,
      recipeItems: {
        include: {
          ingredientProduct: {
            include: {
              category: true,
              recipeItems: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      variationGroups: {
        orderBy: { sortOrder: 'asc' },
        include: {
          options: {
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              recipeItems: {
                include: {
                  ingredientProduct: {
                    include: {
                      category: true,
                      recipeItems: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          },
        },
      },
    },
  })
}

async function resolveVariationOptionPossibleOutputBase(params: {
  companyId: string
  option: any
  outputQuantity: number
  outputUnit: StockUnit
  path: string[]
  depth: number
}): Promise<{
  possibleOutputBase: number | null
  limitingIngredient: { id: string; name: string } | null
}> {
  const { companyId, option, outputQuantity, outputUnit, path, depth } = params
  const optionRecipeItems = option.recipeItems ?? []

  if (optionRecipeItems.length === 0) {
    return {
      possibleOutputBase: null,
      limitingIngredient: null,
    }
  }

  let possibleOutputBase: number | null = null
  let limitingIngredient: { id: string; name: string } | null = null

  for (const item of optionRecipeItems) {
    const ingredient = item.ingredientProduct
    if (!ingredient) continue

    const ingredientQty = Number(item.quantity ?? 0)
    const ingredientUnit = item.unit as StockUnit

    if (!Number.isFinite(ingredientQty) || ingredientQty <= 0) {
      continue
    }

    const ingredientDetails = await getProductForRecipe(companyId, ingredient.id)
    if (!ingredientDetails) throw new Error('RECIPE_INGREDIENT_NOT_FOUND')

    const ingredientIsRecipe =
      ingredientDetails.costMode === 'recipe' &&
      ingredientDetails.recipeItems.length > 0

    const neededBase = toBaseUnit(ingredientQty, ingredientUnit)

    if (ingredientIsRecipe) {
      const nested = await resolveRecipeMetrics(
        companyId,
        ingredient.id,
        path,
        depth + 1
      )

      if (!areUnitsCompatible(nested.outputUnit, ingredientUnit)) {
        throw new Error('RECIPE_UNIT_MISMATCH')
      }

      const nestedPossibleBase =
        nested.possibleOutputQuantity == null
          ? null
          : toBaseUnit(nested.possibleOutputQuantity, nested.outputUnit)

      if (nestedPossibleBase == null) {
        continue
      }

      const possibleFromIngredientBase =
        (nestedPossibleBase / neededBase) * toBaseUnit(outputQuantity, outputUnit)

      if (
        possibleOutputBase == null ||
        possibleFromIngredientBase < possibleOutputBase
      ) {
        possibleOutputBase = possibleFromIngredientBase
        limitingIngredient = nested.limitingIngredient ?? {
          id: ingredient.id,
          name: ingredient.name,
        }
      }

      continue
    }

    const effectiveStockUnit = getEffectiveStockUnit(ingredient, ingredientUnit)

    if (!areUnitsCompatible(effectiveStockUnit, ingredientUnit)) {
      throw new Error('RECIPE_UNIT_MISMATCH')
    }

    if (!ingredient.unlimitedStock) {
      const availableBase = getAvailableBaseQuantity(ingredient, ingredientUnit)
      const possibleFromIngredientBase =
        (availableBase / neededBase) * toBaseUnit(outputQuantity, outputUnit)

      if (
        possibleOutputBase == null ||
        possibleFromIngredientBase < possibleOutputBase
      ) {
        possibleOutputBase = possibleFromIngredientBase
        limitingIngredient = {
          id: ingredient.id,
          name: ingredient.name,
        }
      }
    }
  }

  return {
    possibleOutputBase,
    limitingIngredient,
  }
}

async function resolveRequiredVariationPossibleOutputBase(params: {
  companyId: string
  product: any
  outputQuantity: number
  outputUnit: StockUnit
  path: string[]
  depth: number
}): Promise<{
  possibleOutputBase: number | null
  limitingIngredient: { id: string; name: string } | null
}> {
  const { companyId, product, outputQuantity, outputUnit, path, depth } = params
  const requiredGroups = (product.variationGroups ?? []).filter(
    (group: any) => group.required && (group.options?.length ?? 0) > 0
  )

  let possibleOutputBase: number | null = null
  let limitingIngredient: { id: string; name: string } | null = null

  for (const group of requiredGroups) {
    let bestGroupOutputBase: number | null = null
    let bestGroupLimitingIngredient: { id: string; name: string } | null = null
    let hasUnlimitedOption = false

    for (const option of group.options ?? []) {
      const optionResult = await resolveVariationOptionPossibleOutputBase({
        companyId,
        option,
        outputQuantity,
        outputUnit,
        path,
        depth,
      })

      if (optionResult.possibleOutputBase == null) {
        hasUnlimitedOption = true
        bestGroupOutputBase = null
        bestGroupLimitingIngredient = null
        break
      }

      if (
        bestGroupOutputBase == null ||
        optionResult.possibleOutputBase > bestGroupOutputBase
      ) {
        bestGroupOutputBase = optionResult.possibleOutputBase
        bestGroupLimitingIngredient = optionResult.limitingIngredient
      }
    }

    if (hasUnlimitedOption || bestGroupOutputBase == null) {
      continue
    }

    if (possibleOutputBase == null || bestGroupOutputBase < possibleOutputBase) {
      possibleOutputBase = bestGroupOutputBase
      limitingIngredient = bestGroupLimitingIngredient
    }
  }

  return {
    possibleOutputBase,
    limitingIngredient,
  }
}

async function resolveRecipeMetrics(
  companyId: string,
  productId: string,
  path: string[] = [],
  depth = 0
): Promise<{
  batchCost: number
  outputQuantity: number
  outputUnit: StockUnit
  possibleOutputQuantity: number | null
  limitingIngredient: { id: string; name: string } | null
}> {
  if (depth > MAX_RECIPE_DEPTH) {
    throw new Error('RECIPE_MAX_DEPTH_EXCEEDED')
  }

  if (path.includes(productId)) {
    throw new Error('RECIPE_CYCLE_DETECTED')
  }

  const product = await getProductForRecipe(companyId, productId)

  if (!product) throw new Error('PRODUCT_NOT_FOUND')
  if (product.costMode !== 'recipe' || !product.recipeItems.length) {
    throw new Error('PRODUCT_IS_NOT_RECIPE')
  }

  const outputQuantity = Number(product.recipeOutputQuantity ?? 0)
  const outputUnit = (product.recipeOutputUnit ?? product.stockUnit ?? 'unit') as StockUnit

  if (outputQuantity <= 0) {
    throw new Error('RECIPE_OUTPUT_QUANTITY_REQUIRED')
  }

  const nextPath = [...path, productId]
  let batchCost = 0
  let possibleOutputBase: number | null = null
  let limitingIngredient: { id: string; name: string } | null = null

  for (const item of product.recipeItems) {
    const ingredient = item.ingredientProduct
    if (!ingredient) continue

    const ingredientQty = Number(item.quantity ?? 0)
    const ingredientUnit = item.unit as StockUnit

    const ingredientDetails = await getProductForRecipe(companyId, ingredient.id)
    if (!ingredientDetails) throw new Error('RECIPE_INGREDIENT_NOT_FOUND')

    const ingredientIsRecipe =
      ingredientDetails.costMode === 'recipe' &&
      ingredientDetails.recipeItems.length > 0

    if (ingredientIsRecipe) {
      const nested = await resolveRecipeMetrics(
        companyId,
        ingredient.id,
        nextPath,
        depth + 1
      )

      if (!areUnitsCompatible(nested.outputUnit, ingredientUnit)) {
        throw new Error('RECIPE_UNIT_MISMATCH')
      }

      const nestedOutputBase = toBaseUnit(nested.outputQuantity, nested.outputUnit)
      const neededBase = toBaseUnit(ingredientQty, ingredientUnit)

      if (nestedOutputBase <= 0) {
        throw new Error('RECIPE_OUTPUT_QUANTITY_REQUIRED')
      }

      const multiplier = neededBase / nestedOutputBase
      batchCost += nested.batchCost * multiplier

      if (nested.possibleOutputQuantity != null) {
        const nestedPossibleBase = toBaseUnit(
          nested.possibleOutputQuantity,
          nested.outputUnit
        )

        const possibleFromIngredientBase =
          (nestedPossibleBase / neededBase) * toBaseUnit(outputQuantity, outputUnit)

        if (
          possibleOutputBase == null ||
          possibleFromIngredientBase < possibleOutputBase
        ) {
          possibleOutputBase = possibleFromIngredientBase
          limitingIngredient = nested.limitingIngredient ?? {
            id: ingredient.id,
            name: ingredient.name,
          }
        }
      }

      continue
    }

    const effectiveStockUnit = getEffectiveStockUnit(ingredient, ingredientUnit)

    if (!areUnitsCompatible(effectiveStockUnit, ingredientUnit)) {
      throw new Error('RECIPE_UNIT_MISMATCH')
    }

    const neededBase = toBaseUnit(ingredientQty, ingredientUnit)
    const unitCost = getSimpleUnitCost(ingredient)
    batchCost += unitCost * neededBase

    if (!ingredient.unlimitedStock) {
      const availableBase = getAvailableBaseQuantity(ingredient, ingredientUnit)
      const possibleFromIngredientBase =
        (availableBase / neededBase) * toBaseUnit(outputQuantity, outputUnit)

      if (
        possibleOutputBase == null ||
        possibleFromIngredientBase < possibleOutputBase
      ) {
        possibleOutputBase = possibleFromIngredientBase
        limitingIngredient = {
          id: ingredient.id,
          name: ingredient.name,
        }
      }
    }
  }

  const requiredVariationOutput = await resolveRequiredVariationPossibleOutputBase({
    companyId,
    product,
    outputQuantity,
    outputUnit,
    path: nextPath,
    depth,
  })

  if (
    requiredVariationOutput.possibleOutputBase != null &&
    (possibleOutputBase == null ||
      requiredVariationOutput.possibleOutputBase < possibleOutputBase)
  ) {
    possibleOutputBase = requiredVariationOutput.possibleOutputBase
    limitingIngredient = requiredVariationOutput.limitingIngredient
  }

  return {
    batchCost: Number(batchCost.toFixed(4)),
    outputQuantity,
    outputUnit,
    possibleOutputQuantity:
      possibleOutputBase == null
        ? null
        : outputUnit === 'unit'
        ? Math.floor(fromBaseUnit(possibleOutputBase, outputUnit))
        : Number(fromBaseUnit(possibleOutputBase, outputUnit).toFixed(3)),
    limitingIngredient,
  }
}

async function getDirectRecipeRequirements(
  companyId: string,
  productId: string,
  requestedOutputQuantity: number,
  requestedOutputUnit?: StockUnit
) {
  const product = await getProductForRecipe(companyId, productId)

  if (!product) throw new Error('PRODUCT_NOT_FOUND')
  if (product.costMode !== 'recipe' || !product.recipeItems.length) {
    throw new Error('PRODUCT_IS_NOT_RECIPE')
  }

  const outputQuantity = Number(product.recipeOutputQuantity ?? 0)
  const outputUnit = (product.recipeOutputUnit ?? product.stockUnit ?? 'unit') as StockUnit

  if (outputQuantity <= 0) {
    throw new Error('RECIPE_OUTPUT_QUANTITY_REQUIRED')
  }

  const normalizedRequestedUnit = requestedOutputUnit ?? outputUnit

  if (!areUnitsCompatible(normalizedRequestedUnit, outputUnit)) {
    throw new Error('RECIPE_UNIT_MISMATCH')
  }

  const requestedBase = toBaseUnit(requestedOutputQuantity, normalizedRequestedUnit)
  const recipeOutputBase = toBaseUnit(outputQuantity, outputUnit)

  const multiplier = requestedBase / recipeOutputBase

  return {
    product,
    outputUnit,
    outputQuantity,
    requirements: product.recipeItems.map((item) => {
      const ingredient = item.ingredientProduct
      const requiredQty = Number(item.quantity ?? 0) * multiplier

      return {
        ingredientProductId: ingredient.id,
        ingredientName: ingredient.name,
        ingredientEmoji: ingredient.emoji,
        quantity: requiredQty,
        unit: item.unit as StockUnit,
        ingredient,
      }
    }),
  }
}

async function explodeToBaseItems(
  companyId: string,
  productId: string,
  requestedQuantity: number,
  requestedUnit: StockUnit,
  path: string[] = [],
  depth = 0
): Promise<FlatRequirement[]> {
  if (depth > MAX_RECIPE_DEPTH) throw new Error('RECIPE_MAX_DEPTH_EXCEEDED')
  if (path.includes(productId)) throw new Error('RECIPE_CYCLE_DETECTED')

  const direct = await getDirectRecipeRequirements(
    companyId,
    productId,
    requestedQuantity,
    requestedUnit
  )

  const results: FlatRequirement[] = []

  for (const req of direct.requirements) {
    const ingredient = req.ingredient
    const ingredientIsRecipe =
      ingredient.costMode === 'recipe' &&
      (ingredient.recipeItems?.length ?? 0) > 0

    if (ingredientIsRecipe) {
      const nested = await explodeToBaseItems(
        companyId,
        ingredient.id,
        req.quantity,
        req.unit,
        [...path, productId],
        depth + 1
      )
      results.push(...nested)
      continue
    }

    results.push(
      buildFlatRequirement({
        ingredient,
        requiredQuantity: req.quantity,
        requiredUnit: req.unit,
      })
    )
  }

  return results
}

export async function getStockProducts(companyId: string) {
  const products = await prisma.product.findMany({
    where: {
      companyId,
      active: true,
    },
    orderBy: {
      name: 'asc',
    },
    include: {
      category: true,
      recipeItems: {
        select: {
          id: true,
        },
      },
    },
  })

  const result = []

  for (const product of products) {
    const base = normalizeProduct(product)
    const hasRecipe = (product.recipeItems?.length ?? 0) > 0

    let recipeCost: number | null = null
    let expectedYield: number | null = null

    if (product.costMode === 'recipe' && hasRecipe) {
      try {
        const metrics = await resolveRecipeMetrics(companyId, product.id)
        recipeCost = Number(metrics.batchCost.toFixed(2))
        expectedYield = metrics.possibleOutputQuantity
      } catch {
        recipeCost = null
        expectedYield = null
      }
    }

    result.push({
      ...base,
      hasRecipe,
      recipeCost,
      expectedYield,
      limitingIngredient: null,
    })
  }

  return result
}

export async function createStockMovement(input: {
  companyId: string
  productId: string
  type: StockMovementType
  quantity: number
  reason?: string | null
}) {
  if (!input.type || !['in', 'out', 'adjustment'].includes(input.type)) {
    throw new Error('STOCK_MOVEMENT_TYPE_REQUIRED')
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('STOCK_MOVEMENT_QUANTITY_INVALID')
  }

  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      companyId: input.companyId,
      active: true,
    },
  })

  if (!product) {
    throw new Error('PRODUCT_NOT_FOUND')
  }

  const previousQty = Number(product.stockQuantity ?? 0)
  let newQty = previousQty

  if (input.type === 'in') {
    newQty = previousQty + input.quantity
  } else if (input.type === 'out') {
    newQty = previousQty - input.quantity
  } else if (input.type === 'adjustment') {
    newQty = input.quantity
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: {
        id: product.id,
      },
      data: {
        stockQuantity: newQty,
        trackStock: true,
      },
      include: {
        category: true,
        recipeItems: {
          select: {
            id: true,
          },
        },
      },
    })

    const movement = await tx.stockMovement.create({
      data: {
        companyId: input.companyId,
        productId: product.id,
        type: input.type,
        quantity: input.quantity,
        previousQty,
        newQty,
        reason: input.reason?.trim() || null,
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    })

    return {
      product: {
        ...normalizeProduct(updatedProduct),
        hasRecipe: (updatedProduct.recipeItems?.length ?? 0) > 0,
        recipeCost: null,
        expectedYield: null,
        limitingIngredient: null,
      },
      movement: normalizeMovement(movement),
    }
  })

  return result
}

export async function getProductStockMovements(companyId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      companyId,
      active: true,
    },
  })

  if (!product) {
    throw new Error('PRODUCT_NOT_FOUND')
  }

  const movements = await prisma.stockMovement.findMany({
    where: {
      companyId,
      productId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
    take: 100,
  })

  return movements.map((movement) => normalizeMovement(movement))
}

export async function getRecipeAnalysis(companyId: string, productId: string) {
  const productForUnit = await getProductForRecipe(companyId, productId)

  if (!productForUnit) {
    throw new Error('PRODUCT_NOT_FOUND')
  }

  const outputUnit = (
    productForUnit.recipeOutputUnit ??
    productForUnit.stockUnit ??
    'unit'
  ) as StockUnit

  const direct = await getDirectRecipeRequirements(
    companyId,
    productId,
    1,
    outputUnit
  )

  const metrics = await resolveRecipeMetrics(companyId, productId)

  const recipeItems: FlatRequirement[] = direct.requirements.map((req) => {
    const ingredient = req.ingredient
    const ingredientIsRecipe =
      ingredient.costMode === 'recipe' &&
      (ingredient.recipeItems?.length ?? 0) > 0

    return buildFlatRequirement({
      ingredient,
      requiredQuantity: req.quantity,
      requiredUnit: req.unit,
      ingredientIsRecipe,
    })
  })

  return {
    product: normalizeProduct(direct.product),
    recipeCost: Number(metrics.batchCost.toFixed(2)),
    recipeUnitCost:
      metrics.outputQuantity > 0
        ? Number((metrics.batchCost / metrics.outputQuantity).toFixed(4))
        : 0,
    outputQuantity: metrics.outputQuantity,
    outputUnit: metrics.outputUnit,
    expectedYield: metrics.possibleOutputQuantity,
    limitingIngredient: metrics.limitingIngredient,
    flatRequirements: recipeItems,
    tree: {
      productId: direct.product.id,
      productName: direct.product.name,
      requestedQuantity: 1,
      children: [],
    },
  }
}

export async function calculateRecipeProduction(
  companyId: string,
  productId: string,
  quantity: number
) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('CALCULATOR_QUANTITY_INVALID')
  }

  const productForCalc = await getProductForRecipe(companyId, productId)

  if (!productForCalc) {
    throw new Error('PRODUCT_NOT_FOUND')
  }

  if (productForCalc.costMode !== 'recipe' || !productForCalc.recipeItems.length) {
    throw new Error('PRODUCT_IS_NOT_RECIPE')
  }

  const calcOutputUnit = (
    productForCalc.recipeOutputUnit ??
    productForCalc.stockUnit ??
    'unit'
  ) as StockUnit

  const direct = await getDirectRecipeRequirements(
    companyId,
    productId,
    quantity,
    calcOutputUnit
  )

  const metrics = await resolveRecipeMetrics(companyId, productId)

  const unitCost =
    metrics.outputQuantity > 0 ? metrics.batchCost / metrics.outputQuantity : 0

  const directRequirements: FlatRequirement[] = direct.requirements.map((req) => {
    const ingredient = req.ingredient
    const ingredientIsRecipe =
      ingredient.costMode === 'recipe' &&
      (ingredient.recipeItems?.length ?? 0) > 0

    return buildFlatRequirement({
      ingredient,
      requiredQuantity: req.quantity,
      requiredUnit: req.unit,
      ingredientIsRecipe,
    })
  })

  const nestedRequirements = []

  for (const req of direct.requirements) {
    const ingredient = req.ingredient
    const ingredientIsRecipe =
      ingredient.costMode === 'recipe' &&
      (ingredient.recipeItems?.length ?? 0) > 0

    if (!ingredientIsRecipe) continue

    const baseItems = await explodeToBaseItems(
      companyId,
      ingredient.id,
      req.quantity,
      req.unit
    )

    const displayRequired = normalizeDisplayQuantity(req.quantity, req.unit)

    nestedRequirements.push({
      recipeProductId: ingredient.id,
      recipeProductName: ingredient.name,
      requiredQuantity: displayRequired.quantity,
      unit: displayRequired.unit,
      baseItems,
    })
  }

  return {
    product: normalizeProduct(direct.product),
    requestedQuantity: quantity,
    outputUnit: metrics.outputUnit,
    unitCost: Number(unitCost.toFixed(2)),
    totalCost: Number((unitCost * quantity).toFixed(2)),
    directRequirements,
    nestedRequirements,
    tree: {
      productId: direct.product.id,
      productName: direct.product.name,
      requestedQuantity: quantity,
      children: [],
    },
  }
}
