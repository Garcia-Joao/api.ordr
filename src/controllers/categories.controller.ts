import { Request, Response } from 'express'
import * as categoriesService from '../services/categories.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

function getSingleParam(value: string | string[] | undefined): string {
  if (!value) return ''
  return Array.isArray(value) ? value[0] : value
}

export async function getCategories(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const categories = await categoriesService.getCategoriesByCompany(companyId)
    return res.json(categories)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Failed to fetch categories' })
  }
}

export async function getCategoryById(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const id = getSingleParam(req.params.id)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const category = await categoriesService.getCategoryById(id, companyId)

    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }

    return res.json(category)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Failed to fetch category' })
  }
}

export async function createCategory(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const category = await categoriesService.createCategory(
      {
        companyId,
        ...req.body,
      },
      userId
    )

    return res.status(201).json(category)
  } catch (error: any) {
    console.error('createCategory error:', error)

    if (error?.message === 'CATEGORY_NAME_REQUIRED') {
      return res.status(400).json({ error: 'Category name is required' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to create category',
    })
  }
}

export async function updateCategory(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id
    const id = getSingleParam(req.params.id)

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const category = await categoriesService.updateCategory(
      id,
      companyId,
      req.body,
      userId
    )

    return res.json(category)
  } catch (error: any) {
    console.error(error)

    if (error?.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({ error: 'Category not found' })
    }

    if (error?.message === 'CATEGORY_NAME_REQUIRED') {
      return res.status(400).json({ error: 'Category name is required' })
    }

    return res.status(500).json({ error: 'Failed to update category' })
  }
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id
    const id = getSingleParam(req.params.id)

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await categoriesService.deleteCategory(id, companyId, userId)
    return res.json({ ok: true })
  } catch (error: any) {
    console.error(error)

    if (error?.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({ error: 'Category not found' })
    }

    if (error?.message === 'CATEGORY_HAS_PRODUCTS') {
      return res.status(400).json({ error: 'Category has products linked to it' })
    }

    return res.status(500).json({ error: 'Failed to delete category' })
  }
}