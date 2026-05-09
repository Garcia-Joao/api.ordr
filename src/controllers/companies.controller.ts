import { Request, Response } from 'express'
import * as companiesService from '../services/companies.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

export async function createTestCompany(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id
    const sourceCompanyId = req.user?.companyId
    const { copyData } = req.body as { copyData?: boolean }

    if (!userId || !sourceCompanyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await companiesService.createTestCompanyFromCompany({
      userId,
      sourceCompanyId,
      copyData: Boolean(copyData),
    })

    return res.status(201).json(result)
  } catch (error: any) {
    console.error('createTestCompany error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to create test company',
    })
  }
}