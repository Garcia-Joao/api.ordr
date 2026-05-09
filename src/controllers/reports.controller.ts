import type { Request, Response } from 'express'
import { getReportFilters, getReportsDashboard } from '../services/reports.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

function getCompanyId(req: AuthRequest) {
  return req.user?.companyId
}

function getQueryString(req: Request, key: string) {
  const value = req.query[key]
  if (Array.isArray(value)) return String(value[0] ?? '').trim() || undefined
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export async function getReportsFiltersController(req: AuthRequest, res: Response) {
  try {
    const companyId = getCompanyId(req)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    return res.json(await getReportFilters(companyId))
  } catch (error: any) {
    console.error('getReportsFiltersController error:', error)
    return res.status(500).json({ error: error?.message || 'FAILED_TO_LOAD_REPORT_FILTERS' })
  }
}

export async function getReportsDashboardController(req: AuthRequest, res: Response) {
  try {
    const companyId = getCompanyId(req)

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    return res.json(
      await getReportsDashboard(companyId, {
        fromDate: getQueryString(req, 'fromDate'),
        toDate: getQueryString(req, 'toDate'),
        status: getQueryString(req, 'status') as any,
        paymentMethod: getQueryString(req, 'paymentMethod') as any,
        eventDateId: getQueryString(req, 'eventDateId'),
        salesEnvironmentId: getQueryString(req, 'salesEnvironmentId'),
        categoryId: getQueryString(req, 'categoryId'),
        productId: getQueryString(req, 'productId'),
        customerId: getQueryString(req, 'customerId'),
        internalCustomerId: getQueryString(req, 'internalCustomerId'),
        comanda: getQueryString(req, 'comanda'),
        taxApplied: getQueryString(req, 'taxApplied'),
      })
    )
  } catch (error: any) {
    console.error('getReportsDashboardController error:', error)
    return res.status(500).json({ error: error?.message || 'FAILED_TO_LOAD_REPORTS_DASHBOARD' })
  }
}
