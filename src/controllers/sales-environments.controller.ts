import { Request, Response } from 'express'
import * as salesEnvironmentsService from '../services/sales-environments.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

export async function getSalesEnvironments(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const environments = await salesEnvironmentsService.getSalesEnvironments(companyId)
    return res.json(environments)
  } catch (error: any) {
    console.error('getSalesEnvironments error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to fetch sales environments',
    })
  }
}

export async function createSalesEnvironment(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { name, color } = req.body as {
      name?: string
      color?: string
    }

    const environment = await salesEnvironmentsService.createSalesEnvironment({
      companyId,
      name: name ?? '',
      color: color ?? '',
    })

    return res.status(201).json(environment)
  } catch (error: any) {
    console.error('createSalesEnvironment error:', error)

    switch (error?.message) {
      case 'COMPANY_ID_REQUIRED':
        return res.status(400).json({ error: 'Company ID is required' })
      case 'SALES_ENVIRONMENT_NAME_REQUIRED':
        return res.status(400).json({ error: 'Environment name is required' })
      case 'SALES_ENVIRONMENT_COLOR_REQUIRED':
        return res.status(400).json({ error: 'Environment color is required' })
      case 'SALES_ENVIRONMENT_NAME_ALREADY_EXISTS':
        return res.status(400).json({ error: 'An environment with this name already exists' })
      default:
        return res.status(500).json({
          error: error?.message || 'Failed to create sales environment',
        })
    }
  }
}

export async function deleteSalesEnvironment(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const environmentId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const environment = await salesEnvironmentsService.deleteSalesEnvironment({
      companyId,
      environmentId,
    })

    return res.json({ ok: true, environment })
  } catch (error: any) {
    console.error('deleteSalesEnvironment error:', error)

    switch (error?.message) {
      case 'SALES_ENVIRONMENT_NOT_FOUND':
        return res.status(404).json({ error: 'Sales environment not found' })
      case 'SALES_ENVIRONMENT_DEFAULT_CANNOT_BE_DELETED':
        return res.status(400).json({ error: 'Default environment cannot be deleted' })
      case 'SALES_ENVIRONMENT_HAS_CUSTOMERS':
        return res.status(400).json({
          error: 'This environment has internal customers linked to it',
        })
      default:
        return res.status(500).json({
          error: error?.message || 'Failed to delete sales environment',
        })
    }
  }
}