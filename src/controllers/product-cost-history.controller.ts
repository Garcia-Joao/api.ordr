import type { Request, Response } from 'express'
import * as service from '../services/product-cost-history.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export async function getProductCostHistoryController(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await service.getProductCostHistory(companyId, {
      fromDate: readString(req.query.fromDate),
      toDate: readString(req.query.toDate),
      productId: readString(req.query.productId),
      categoryId: readString(req.query.categoryId),
    })

    return res.json(result)
  } catch (error: any) {
    console.error('getProductCostHistoryController error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to load product cost history',
    })
  }
}
