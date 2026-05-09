import { Request, Response } from 'express'
import * as stockService from '../services/stock.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

export async function getStockProducts(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const products = await stockService.getStockProducts(companyId)
    return res.json(products)
  } catch (error: any) {
    console.error('getStockProducts error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to fetch stock products',
    })
  }
}

export async function createStockMovement(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { productId, type, quantity, reason } = req.body as {
      productId?: string
      type?: 'in' | 'out' | 'adjustment'
      quantity?: number
      reason?: string | null
    }

    const movement = await stockService.createStockMovement({
      companyId,
      userId,
      productId: productId ?? '',
      type: type as 'in' | 'out' | 'adjustment',
      quantity: Number(quantity ?? 0),
      reason: reason ?? null,
    })

    return res.status(201).json(movement)
  } catch (error: any) {
    console.error('createStockMovement error:', error)

    switch (error?.message) {
      case 'PRODUCT_NOT_FOUND':
        return res.status(404).json({ error: 'Product not found' })
      case 'STOCK_MOVEMENT_TYPE_REQUIRED':
        return res.status(400).json({ error: 'Movement type is required' })
      case 'STOCK_MOVEMENT_QUANTITY_INVALID':
        return res.status(400).json({ error: 'Quantity must be greater than zero' })
      default:
        return res.status(500).json({
          error: error?.message || 'Failed to create stock movement',
        })
    }
  }
}

export async function getProductStockMovements(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const productId = Array.isArray(req.params.productId)
      ? req.params.productId[0]
      : req.params.productId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const movements = await stockService.getProductStockMovements(companyId, productId)
    return res.json(movements)
  } catch (error: any) {
    console.error('getProductStockMovements error:', error)

    if (error?.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({ error: 'Product not found' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to fetch stock movements',
    })
  }
}

export async function getRecipeAnalysis(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const productId = Array.isArray(req.params.productId)
      ? req.params.productId[0]
      : req.params.productId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const analysis = await stockService.getRecipeAnalysis(companyId, productId)
    return res.json(analysis)
  } catch (error: any) {
    console.error('getRecipeAnalysis error:', error)

    switch (error?.message) {
      case 'PRODUCT_NOT_FOUND':
        return res.status(404).json({ error: 'Product not found' })
      case 'PRODUCT_IS_NOT_RECIPE':
        return res.status(400).json({ error: 'Product is not a recipe' })
      case 'RECIPE_CYCLE_DETECTED':
        return res.status(400).json({ error: 'Recipe cycle detected' })
      case 'RECIPE_UNIT_MISMATCH':
        return res.status(400).json({ error: 'Recipe unit mismatch' })
      case 'RECIPE_MAX_DEPTH_EXCEEDED':
        return res.status(400).json({ error: 'Recipe nesting too deep' })
      case 'RECIPE_OUTPUT_QUANTITY_REQUIRED':
        return res.status(400).json({ error: 'Recipe output quantity is required' })
      default:
        return res.status(500).json({
          error: error?.message || 'Failed to analyze recipe',
        })
    }
  }
}

export async function calculateRecipeProduction(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const productId = Array.isArray(req.params.productId)
      ? req.params.productId[0]
      : req.params.productId
    const quantity = Number(req.query.quantity ?? 0)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await stockService.calculateRecipeProduction(
      companyId,
      productId,
      quantity
    )

    return res.json(result)
  } catch (error: any) {
    console.error('calculateRecipeProduction error:', error)

    switch (error?.message) {
      case 'PRODUCT_NOT_FOUND':
        return res.status(404).json({ error: 'Product not found' })
      case 'PRODUCT_IS_NOT_RECIPE':
        return res.status(400).json({ error: 'Product is not a recipe' })
      case 'RECIPE_CYCLE_DETECTED':
        return res.status(400).json({ error: 'Recipe cycle detected' })
      case 'RECIPE_UNIT_MISMATCH':
        return res.status(400).json({ error: 'Recipe unit mismatch' })
      case 'RECIPE_MAX_DEPTH_EXCEEDED':
        return res.status(400).json({ error: 'Recipe nesting too deep' })
      case 'RECIPE_OUTPUT_QUANTITY_REQUIRED':
        return res.status(400).json({ error: 'Recipe output quantity is required' })
      case 'CALCULATOR_QUANTITY_INVALID':
        return res.status(400).json({ error: 'Invalid quantity' })
      default:
        return res.status(500).json({
          error: error?.message || 'Failed to calculate production',
        })
    }
  }
}