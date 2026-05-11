import type { Request, Response } from 'express'
import {
  createPriceTable,
  createPriceTableItem,
  deletePriceTable,
  deletePriceTableItem,
  getDashboard,
  getProfile,
  listOrders,
  listPriceTables,
  listProducts,
  updateAvailability,
  updatePriceTable,
  updatePriceTableItem,
  updateProfile,
} from '../services/supplier-portal.service'

type AuthRequest = Request & { user?: { companyId?: string } }

function getCompanyId(req: AuthRequest) {
  const companyId = req.user?.companyId
  if (!companyId) throw new Error('COMPANY_ID_REQUIRED')
  return companyId
}

function getParam(value: string | string[] | undefined, field: string) {
  const normalized = Array.isArray(value) ? value[0] : value
  if (!normalized) throw new Error(`${field}_REQUIRED`)
  return normalized
}

function handleError(res: Response, error: any) {
  const message = error?.message ?? 'INTERNAL_ERROR'
  const status =
    message.includes('NOT_FOUND')
      ? 404
      : message.includes('REQUIRED') || message.includes('INVALID') || message.includes('FAILED')
        ? 400
        : message.includes('SUPPLIER_COMPANY_REQUIRED')
          ? 403
          : 500

  if (status >= 500) console.error('[supplier-portal]', error)
  return res.status(status).json({ error: message })
}

export async function dashboardController(req: AuthRequest, res: Response) {
  try {
    return res.json(await getDashboard(getCompanyId(req)))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function profileController(req: AuthRequest, res: Response) {
  try {
    return res.json(await getProfile(getCompanyId(req)))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updateProfileController(req: AuthRequest, res: Response) {
  try {
    return res.json(await updateProfile(getCompanyId(req), req.body))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function availabilityController(req: AuthRequest, res: Response) {
  try {
    return res.json(await updateAvailability(getCompanyId(req), Boolean(req.body?.onlineEnabled)))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function productsController(req: AuthRequest, res: Response) {
  try {
    return res.json(await listProducts(getCompanyId(req)))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function ordersController(req: AuthRequest, res: Response) {
  try {
    return res.json(await listOrders(getCompanyId(req)))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function priceTablesController(req: AuthRequest, res: Response) {
  try {
    return res.json(await listPriceTables(getCompanyId(req)))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createPriceTableController(req: AuthRequest, res: Response) {
  try {
    return res.status(201).json(await createPriceTable(getCompanyId(req), req.body))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updatePriceTableController(req: AuthRequest, res: Response) {
  try {
    return res.json(await updatePriceTable(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), req.body))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function deletePriceTableController(req: AuthRequest, res: Response) {
  try {
    return res.json(await deletePriceTable(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID')))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createPriceTableItemController(req: AuthRequest, res: Response) {
  try {
    return res.status(201).json(await createPriceTableItem(getCompanyId(req), getParam(req.params.tableId, 'TABLE_ID'), req.body))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updatePriceTableItemController(req: AuthRequest, res: Response) {
  try {
    return res.json(await updatePriceTableItem(
      getCompanyId(req),
      getParam(req.params.tableId, 'TABLE_ID'),
      getParam(req.params.itemId, 'ITEM_ID'),
      req.body
    ))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function deletePriceTableItemController(req: AuthRequest, res: Response) {
  try {
    return res.json(await deletePriceTableItem(
      getCompanyId(req),
      getParam(req.params.tableId, 'TABLE_ID'),
      getParam(req.params.itemId, 'ITEM_ID')
    ))
  } catch (error) {
    return handleError(res, error)
  }
}
