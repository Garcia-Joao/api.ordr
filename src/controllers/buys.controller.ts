import type { Request, Response } from 'express'
import {
  addOrUpdateBuyCartItem,
  cancelBuyRequest,
  clearBuyCart,
  confirmBuyCart,
  createBuyRequest,
  getBuyCart,
  getBuyRequest,
  listBuyRequests,
  printBuyRequestShoppingList,
  receiveBuyRequest,
  removeBuyCartItem,
  updateBuyCart,
} from '../services/buys.service'

function getSingleParam(value: string | string[] | undefined, fieldName: string) {
  const normalized = Array.isArray(value) ? value[0] : value

  if (!normalized || typeof normalized !== 'string') {
    throw new Error(`${fieldName}_REQUIRED`)
  }

  return normalized
}

function getCompanyId(req: Request) {
  const user = (req as any).user
  const headerCompanyId = req.headers['x-company-id']

  const companyId =
    user?.companyId ??
    user?.company?.id ??
    getSingleParam(headerCompanyId, 'COMPANY_ID')

  return companyId
}

function handleError(res: Response, error: any) {
  const message = error?.message ?? 'INTERNAL_ERROR'

  const status =
    message.includes('NOT_FOUND')
      ? 404
      : message.includes('REQUIRED') ||
          message.includes('INVALID') ||
          message.includes('EMPTY') ||
          message.includes('ALREADY') ||
          message.includes('CANCELLED')
        ? 400
        : 500

  return res.status(status).json({ error: message })
}

export async function getBuyCartController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    return res.json(await getBuyCart(companyId))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updateBuyCartController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    return res.json(await updateBuyCart(companyId, req.body))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function upsertBuyCartItemController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    return res.json(await addOrUpdateBuyCartItem(companyId, req.body))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function removeBuyCartItemController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const productId = getSingleParam(req.params.productId, 'PRODUCT_ID')
    return res.json(await removeBuyCartItem(companyId, productId))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function clearBuyCartController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    return res.json(await clearBuyCart(companyId))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function confirmBuyCartController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    return res.status(201).json(await confirmBuyCart({ companyId, ...req.body }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function listBuyRequestsController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    return res.json(await listBuyRequests(companyId))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function getBuyRequestController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const id = getSingleParam(req.params.id, 'BUY_REQUEST_ID')
    return res.json(await getBuyRequest(companyId, id))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createBuyRequestController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    return res.status(201).json(await createBuyRequest({ companyId, ...req.body }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function receiveBuyRequestController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const buyRequestId = getSingleParam(req.params.id, 'BUY_REQUEST_ID')
    return res.json(
      await receiveBuyRequest({
        companyId,
        buyRequestId,
        items: req.body.items ?? [],
      })
    )
  } catch (error) {
    return handleError(res, error)
  }
}


export async function printBuyRequestShoppingListController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const id = getSingleParam(req.params.id, 'BUY_REQUEST_ID')
    return res.json(await printBuyRequestShoppingList(companyId, id))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function cancelBuyRequestController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const id = getSingleParam(req.params.id, 'BUY_REQUEST_ID')
    return res.json(await cancelBuyRequest(companyId, id))
  } catch (error) {
    return handleError(res, error)
  }
}
