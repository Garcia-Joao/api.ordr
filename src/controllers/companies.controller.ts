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

function statusForCompanyError(message?: string) {
  if (message === 'COMPANY_ACCESS_DENIED') return 403
  if (message === 'ADMIN_ACCESS_REQUIRED') return 403
  if (message === 'SOURCE_COMPANY_NOT_FOUND') return 404
  if (message === 'COMPANY_NOT_FOUND') return 404
  if (message === 'SOURCE_COMPANY_IS_ALREADY_TEST') return 400
  if (message === 'ONLY_TEST_COMPANY_CAN_BE_DELETED') return 400
  return 500
}

export async function createTestCompany(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id
    const currentCompanyId = req.user?.companyId
    const { copyData, sourceCompanyId } = req.body as {
      copyData?: boolean
      sourceCompanyId?: string
    }

    const resolvedSourceCompanyId = sourceCompanyId || currentCompanyId

    if (!userId || !resolvedSourceCompanyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await companiesService.createTestCompanyFromCompany({
      userId,
      sourceCompanyId: resolvedSourceCompanyId,
      copyData: Boolean(copyData),
    })

    return res.status(201).json(result)
  } catch (error: any) {
    console.error('createTestCompany error:', error)
    return res.status(statusForCompanyError(error?.message)).json({
      error: error?.message || 'Failed to create test company',
    })
  }
}

export async function deleteTestCompany(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id
    const { companyId } = req.params as { companyId?: string }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' })
    }

    const result = await companiesService.deleteTestCompany({
      userId,
      companyId,
    })

    return res.json(result)
  } catch (error: any) {
    console.error('deleteTestCompany error:', error)
    return res.status(statusForCompanyError(error?.message)).json({
      error: error?.message || 'Failed to delete test company',
    })
  }
}


export async function getPdvSettings(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const settings = await companiesService.getPdvSettings(companyId)
    return res.json(settings)
  } catch (error: any) {
    console.error('getPdvSettings error:', error)
    return res.status(statusForCompanyError(error?.message)).json({
      error: error?.message || 'Failed to load PDV settings',
    })
  }
}

export async function updatePdvSettings(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const settings = await companiesService.updatePdvSettings(companyId, req.body ?? {})
    return res.json(settings)
  } catch (error: any) {
    console.error('updatePdvSettings error:', error)
    return res.status(statusForCompanyError(error?.message)).json({
      error: error?.message || 'Failed to save PDV settings',
    })
  }
}
