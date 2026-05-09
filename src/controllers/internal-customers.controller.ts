import type { Request, Response } from 'express'
import * as internalCustomersService from '../services/internal-customers.service'

function getParam(value: string | string[] | undefined, name: string) {
  if (!value) {
    throw new Error(`${name.toUpperCase()}_REQUIRED`)
  }

  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export async function getInternalCustomers(_req: Request, res: Response) {
  try {
    const customers = await internalCustomersService.listInternalCustomers()
    return res.json(customers)
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      error: getErrorMessage(error, 'INTERNAL_CUSTOMERS_LIST_ERROR'),
    })
  }
}

export async function getInternalCustomerTodayOrders(req: Request, res: Response) {
  try {
    const customerId = getParam(req.params.id, 'id')

    const result =
      await internalCustomersService.getInternalCustomerTodayOrders(customerId)

    return res.json(result)
  } catch (error) {
    const message = getErrorMessage(error, 'INTERNAL_CUSTOMER_TODAY_ORDERS_ERROR')

    if (message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
      return res.status(404).json({ error: message })
    }

    console.error(error)

    return res.status(400).json({
      error: message,
    })
  }
}

export async function getInternalCustomerPendingOrders(
  req: Request,
  res: Response
) {
  try {
    const customerId = getParam(req.params.id, 'id')

    const result =
      await internalCustomersService.getInternalCustomerPendingOrders(customerId)

    return res.json(result)
  } catch (error) {
    const message = getErrorMessage(error, 'INTERNAL_CUSTOMER_PENDING_ORDERS_ERROR')

    if (message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
      return res.status(404).json({ error: message })
    }

    console.error(error)

    return res.status(400).json({
      error: message,
    })
  }
}

export async function paySelectedInternalCustomerOrders(
  req: Request,
  res: Response
) {
  try {
    const customerId = getParam(req.params.id, 'id')

    const result =
      await internalCustomersService.paySelectedInternalCustomerOrders(
        customerId,
        req.body
      )

    return res.json(result)
  } catch (error) {
    const message = getErrorMessage(error, 'INTERNAL_CUSTOMER_PAYMENT_ERROR')

    if (message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
      return res.status(404).json({ error: message })
    }

    if (message === 'NO_ORDERS_SELECTED') {
      return res.status(400).json({ error: message })
    }

    console.error(error)

    return res.status(400).json({
      error: message,
    })
  }
}