import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import {
  getInternalCustomerPendingOrders,
  getInternalCustomerTodayOrders,
  listInternalCustomers,
  paySelectedInternalCustomerOrders,
} from '../services/internal-customers.service'

export const internalCustomersRoutes = Router()

function getRouteParam(value: string | string[] | undefined, paramName: string) {
  if (!value) {
    throw new Error(`${paramName.toUpperCase()}_REQUIRED`)
  }

  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

internalCustomersRoutes.get(
  '/',
  requireAuth,
  requirePermission('internalCustomers.view', 'interno.view'),
  async (_req, res) => {
    try {
      const customers = await listInternalCustomers()
      return res.json(customers)
    } catch (error: any) {
      console.error(error)

      return res.status(500).json({
        error: error?.message || 'INTERNAL_CUSTOMERS_LIST_ERROR',
      })
    }
  }
)

internalCustomersRoutes.get(
  '/:id/orders/today',
  requireAuth,
  requirePermission('internalCustomers.view', 'interno.view'),
  async (req, res) => {
    try {
      const customerId = getRouteParam(req.params.id, 'id')
      const result = await getInternalCustomerTodayOrders(customerId)

      return res.json(result)
    } catch (error: any) {
      if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
        return res.status(404).json({
          error: 'INTERNAL_CUSTOMER_NOT_FOUND',
        })
      }

      console.error(error)

      return res.status(500).json({
        error: error?.message || 'INTERNAL_CUSTOMER_TODAY_ERROR',
      })
    }
  }
)

internalCustomersRoutes.get(
  '/:id/orders/pending',
  requireAuth,
  requirePermission('internalCustomers.view', 'interno.view'),
  async (req, res) => {
    try {
      const customerId = getRouteParam(req.params.id, 'id')
      const result = await getInternalCustomerPendingOrders(customerId)

      return res.json(result)
    } catch (error: any) {
      if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
        return res.status(404).json({
          error: 'INTERNAL_CUSTOMER_NOT_FOUND',
        })
      }

      console.error(error)

      return res.status(500).json({
        error: error?.message || 'INTERNAL_CUSTOMER_PENDING_ERROR',
      })
    }
  }
)

internalCustomersRoutes.post(
  '/:id/orders/pay',
  requireAuth,
  requirePermission('internalCustomers.pay', 'interno.view'),
  async (req, res) => {
    try {
      const customerId = getRouteParam(req.params.id, 'id')
      const result = await paySelectedInternalCustomerOrders(customerId, req.body)

      return res.json(result)
    } catch (error: any) {
      if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
        return res.status(404).json({
          error: 'INTERNAL_CUSTOMER_NOT_FOUND',
        })
      }

      if (error?.message === 'NO_ORDERS_SELECTED') {
        return res.status(400).json({
          error: 'NO_ORDERS_SELECTED',
        })
      }

      console.error(error)

      return res.status(400).json({
        error: error?.message || 'INTERNAL_CUSTOMER_PAY_ERROR',
      })
    }
  }
)
