import type { Request, Response } from 'express'
import {
  createSupplier,
  createSupplierPriceTable,
  createSupplierPriceTableItem,
  deactivateSupplier,
  deleteInactiveSupplier,
  deleteSupplierPriceTable,
  deleteSupplierPriceTableItem,
  getSupplier,
  listSuppliers,
  reactivateSupplier,
  updateSupplier,
  updateSupplierPriceTable,
  updateSupplierPriceTableItem,
} from '../services/suppliers.service'

function getSingleParam(value: string | string[] | undefined, fieldName: string) {
  const normalized = Array.isArray(value) ? value[0] : value
  if (!normalized || typeof normalized !== 'string') throw new Error(`${fieldName}_REQUIRED`)
  return normalized
}

function getCompanyId(req: Request) {
  const user = (req as any).user
  const headerCompanyId = req.headers['x-company-id']

  return user?.companyId ?? user?.company?.id ?? getSingleParam(headerCompanyId, 'COMPANY_ID')
}

function handleError(res: Response, error: any) {
  const message = error?.message ?? 'INTERNAL_ERROR'

  const status =
    message.includes('NOT_FOUND')
      ? 404
      : message.includes('REQUIRED') ||
          message.includes('INVALID') ||
          message.includes('MUST') ||
          message.includes('ALREADY') ||
          message.includes('key')
        ? 400
        : 500

  return res.status(status).json({ error: message })
}

export async function listSuppliersController(req: Request, res: Response) {
  try {
    return res.json(await listSuppliers(getCompanyId(req)))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function getSupplierController(req: Request, res: Response) {
  try {
    return res.json(await getSupplier(getCompanyId(req), getSingleParam(req.params.id, 'SUPPLIER_ID')))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createSupplierController(req: Request, res: Response) {
  try {
    return res.status(201).json(await createSupplier({ companyId: getCompanyId(req), ...req.body }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updateSupplierController(req: Request, res: Response) {
  try {
    return res.json(await updateSupplier({
      companyId: getCompanyId(req),
      supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
      ...req.body,
    }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function deactivateSupplierController(req: Request, res: Response) {
  try {
    return res.json(await deactivateSupplier(getCompanyId(req), getSingleParam(req.params.id, 'SUPPLIER_ID')))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function reactivateSupplierController(req: Request, res: Response) {
  try {
    return res.json(await reactivateSupplier(getCompanyId(req), getSingleParam(req.params.id, 'SUPPLIER_ID')))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function deleteSupplierController(req: Request, res: Response) {
  try {
    return res.json(await deleteInactiveSupplier(getCompanyId(req), getSingleParam(req.params.id, 'SUPPLIER_ID')))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createSupplierPriceTableController(req: Request, res: Response) {
  try {
    return res.status(201).json(await createSupplierPriceTable({
      companyId: getCompanyId(req),
      supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
      ...req.body,
    }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updateSupplierPriceTableController(req: Request, res: Response) {
  try {
    return res.json(await updateSupplierPriceTable({
      companyId: getCompanyId(req),
      supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
      priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
      ...req.body,
    }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function deleteSupplierPriceTableController(req: Request, res: Response) {
  try {
    return res.json(await deleteSupplierPriceTable({
      companyId: getCompanyId(req),
      supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
      priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
    }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createSupplierPriceTableItemController(req: Request, res: Response) {
  try {
    return res.status(201).json(await createSupplierPriceTableItem({
      companyId: getCompanyId(req),
      supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
      priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
      ...req.body,
    }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updateSupplierPriceTableItemController(req: Request, res: Response) {
  try {
    return res.json(await updateSupplierPriceTableItem({
      companyId: getCompanyId(req),
      supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
      priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
      itemId: getSingleParam(req.params.itemId, 'PRICE_TABLE_ITEM_ID'),
      ...req.body,
    }))
  } catch (error) {
    return handleError(res, error)
  }
}

export async function deleteSupplierPriceTableItemController(req: Request, res: Response) {
  try {
    return res.json(await deleteSupplierPriceTableItem({
      companyId: getCompanyId(req),
      supplierId: getSingleParam(req.params.id, 'SUPPLIER_ID'),
      priceTableId: getSingleParam(req.params.tableId, 'PRICE_TABLE_ID'),
      itemId: getSingleParam(req.params.itemId, 'PRICE_TABLE_ITEM_ID'),
    }))
  } catch (error) {
    return handleError(res, error)
  }
}
