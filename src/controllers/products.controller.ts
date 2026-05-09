import { Request, Response } from 'express'
import * as productsService from '../services/products.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

export async function getProducts(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const includeInactive = req.query.includeInactive === 'true'

    const products = await productsService.getProductsByCompany(
      companyId,
      includeInactive
    )
    return res.json(products)
  } catch (error: any) {
    console.error(error)
    return res.status(500).json({ error: error?.message || 'Failed to fetch products' })
  }
}

export async function getProductById(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const product = await productsService.getProductById(id, companyId)

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    return res.json(product)
  } catch (error: any) {
    console.error(error)
    return res.status(500).json({ error: error?.message || 'Failed to fetch product' })
  }
}

export async function createProduct(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const product = await productsService.createProduct(
      {
        companyId,
        ...req.body,
      },
      userId
    )

    return res.status(201).json(product)
  } catch (error: any) {
    console.error('createProduct error:', error)

    switch (error?.message) {
      case 'CATEGORY_NOT_FOUND':
        return res.status(400).json({ error: 'Category not found' })
      case 'CATEGORY_REQUIRED':
        return res.status(400).json({ error: 'Category is required' })
      case 'RECIPE_INGREDIENT_REQUIRED':
        return res.status(400).json({ error: 'Recipe ingredient is required' })
      case 'RECIPE_INGREDIENT_NOT_FOUND':
        return res.status(400).json({ error: 'Recipe ingredient not found' })
      case 'RECIPE_INGREDIENT_CANNOT_BE_SELF':
        return res.status(400).json({ error: 'A product cannot use itself as ingredient' })
      case 'RECIPE_CYCLE_DETECTED':
        return res.status(400).json({ error: 'Recipe cycle detected' })
      case 'RECIPE_ITEMS_REQUIRED':
        return res.status(400).json({ error: 'Recipe items are required' })
      case 'RECIPE_OUTPUT_QUANTITY_REQUIRED':
        return res.status(400).json({ error: 'Recipe output quantity is required' })
      case 'RECIPE_OUTPUT_UNIT_REQUIRED':
        return res.status(400).json({ error: 'Recipe output unit is required' })
      default:
        if (error?.code === 'P2002') {
          return res.status(400).json({
            error: 'A product with this name already exists in this company',
          })
        }

        return res.status(500).json({
          error: error?.message || 'Failed to create product',
        })
    }
  }
}

export async function updateProduct(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const product = await productsService.updateProduct(id, companyId, req.body, userId)
    return res.json(product)
  } catch (error: any) {
    console.error(error)

    switch (error?.message) {
      case 'PRODUCT_NOT_FOUND':
        return res.status(404).json({ error: 'Product not found' })
      case 'CATEGORY_NOT_FOUND':
        return res.status(400).json({ error: 'Category not found' })
      case 'CATEGORY_REQUIRED':
        return res.status(400).json({ error: 'Category is required' })
      case 'RECIPE_INGREDIENT_REQUIRED':
        return res.status(400).json({ error: 'Recipe ingredient is required' })
      case 'RECIPE_INGREDIENT_NOT_FOUND':
        return res.status(400).json({ error: 'Recipe ingredient not found' })
      case 'RECIPE_INGREDIENT_CANNOT_BE_SELF':
        return res.status(400).json({ error: 'A product cannot use itself as ingredient' })
      case 'RECIPE_CYCLE_DETECTED':
        return res.status(400).json({ error: 'Recipe cycle detected' })
      case 'RECIPE_ITEMS_REQUIRED':
        return res.status(400).json({ error: 'Recipe items are required' })
      case 'RECIPE_OUTPUT_QUANTITY_REQUIRED':
        return res.status(400).json({ error: 'Recipe output quantity is required' })
      case 'RECIPE_OUTPUT_UNIT_REQUIRED':
        return res.status(400).json({ error: 'Recipe output unit is required' })
      default:
        return res.status(500).json({ error: error?.message || 'Failed to update product' })
    }
  }
}

export async function deleteProduct(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await productsService.deleteProduct(id, companyId, userId)
    return res.json({ ok: true })
  } catch (error: any) {
    console.error('deleteProduct error:', error)

    if (error?.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({ error: 'Product not found' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to delete product',
    })
  }
}