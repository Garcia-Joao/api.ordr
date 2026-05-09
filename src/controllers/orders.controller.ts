import { Request, Response } from 'express'
import * as orderService from '../services/orders.service'

type AuthRequest = Request & {
  user?: {
    id: string
    username: string
    role: string
    companyId: string
  }
}

export async function getOrders(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const includeCancelled = req.query.includeCancelled === 'true'
    const orders = await orderService.getOrdersByCompany(companyId, includeCancelled)

    return res.json(orders)
  } catch (error: any) {
    console.error('getOrders error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to fetch orders',
    })
  }
}

export async function createOrder(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const order = await orderService.createOrder(
      {
        companyId,
        ...req.body,
      },
      userId
    )

    return res.status(201).json(order)
  } catch (error: any) {
    console.error('createOrder error:', error)

    switch (error?.message) {
      case 'ORDER_COMPANY_ID_REQUIRED':
        return res.status(400).json({ error: 'Company ID is required' })
      case 'INTERNAL_CUSTOMER_DISABLED':
        return res.status(400).json({ error: 'INTERNAL_CUSTOMER_DISABLED' })
      case 'ORDER_COMANDA_REQUIRED':
        return res.status(400).json({ error: 'Comanda is required' })
      case 'ORDER_ITEMS_REQUIRED':
        return res.status(400).json({ error: 'Order items are required' })
      case 'ORDER_PAYMENT_METHOD_REQUIRED':
        return res.status(400).json({ error: 'Payment method is required' })
      case 'INTERNAL_CUSTOMER_NOT_FOUND':
        return res.status(404).json({ error: 'Internal customer not found' })
      default:
        return res.status(500).json({
          error: error?.message || 'Failed to create order',
        })
    }
  }
}

export async function cancelOrder(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const order = await orderService.cancelOrder(id, companyId, userId)
    return res.json(order)
  } catch (error: any) {
    console.error('cancelOrder error:', error)

    if (error?.message === 'ORDER_NOT_FOUND') {
      return res.status(404).json({ error: 'Order not found' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to cancel order',
    })
  }
}

export async function getInternalCustomerTodayOrders(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const internalCustomerId = Array.isArray(req.params.internalCustomerId)
      ? req.params.internalCustomerId[0]
      : req.params.internalCustomerId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await orderService.getInternalCustomerTodayOrders(
      companyId,
      internalCustomerId
    )

    return res.json(result)
  } catch (error: any) {
    console.error('getInternalCustomerTodayOrders error:', error)

    if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
      return res.status(404).json({ error: 'Internal customer not found' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to load internal customer orders',
    })
  }
}

export async function payInternalCustomerTodayOrders(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id
    const internalCustomerId = Array.isArray(req.params.internalCustomerId)
      ? req.params.internalCustomerId[0]
      : req.params.internalCustomerId

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { paymentMethod, taxApplied } = req.body as {
      paymentMethod?: 'money' | 'pix' | 'credit' | 'debit'
      taxApplied?: boolean
    }

    const result = await orderService.payInternalCustomerTodayOrders({
      companyId,
      internalCustomerId,
      paymentMethod: paymentMethod as any,
      taxApplied: Boolean(taxApplied),
      userId,
    })

    return res.json(result)
  } catch (error: any) {
    console.error('payInternalCustomerTodayOrders error:', error)

    switch (error?.message) {
      case 'ORDER_PAYMENT_METHOD_REQUIRED':
        return res.status(400).json({ error: 'Payment method is required' })
      case 'INTERNAL_CUSTOMER_NOT_FOUND':
        return res.status(404).json({ error: 'Internal customer not found' })
      default:
        return res.status(500).json({
          error: error?.message || 'Failed to pay internal customer orders',
        })
    }
  }
}

export async function downloadOrdersReportPdf(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const buffer = await orderService.generateOrdersReportPdf(companyId)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="orders-report.pdf"')
    return res.send(buffer)
  } catch (error: any) {
    console.error('downloadOrdersReportPdf error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to generate orders report PDF',
    })
  }
}

export async function getOrdersReportSummary(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const fromDate =
      typeof req.query.fromDate === 'string' && req.query.fromDate.trim()
        ? req.query.fromDate.trim()
        : undefined

    const toDate =
      typeof req.query.toDate === 'string' && req.query.toDate.trim()
        ? req.query.toDate.trim()
        : undefined

    const summary = await orderService.getOrdersReportSummary(
      companyId,
      fromDate,
      toDate
    )

    return res.json(summary)
  } catch (error: any) {
    console.error('getOrdersReportSummary error:', error)
    return res.status(500).json({
      error: error?.message || 'Failed to load report summary',
    })
  }
}

export async function paySelectedInternalCustomerOrders(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.id
    const internalCustomerId = Array.isArray(req.params.internalCustomerId)
      ? req.params.internalCustomerId[0]
      : req.params.internalCustomerId

    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { paymentMethod, taxApplied, orderIds } = req.body as {
      paymentMethod?: 'money' | 'pix' | 'credit' | 'debit'
      taxApplied?: boolean
      orderIds?: string[]
    }

    const result = await orderService.paySelectedInternalCustomerOrders({
      companyId,
      internalCustomerId,
      paymentMethod: paymentMethod as any,
      taxApplied: Boolean(taxApplied),
      orderIds: Array.isArray(orderIds) ? orderIds : [],
      userId,
    })

    return res.json(result)
  } catch (error: any) {
    console.error('paySelectedInternalCustomerOrders error:', error)

    switch (error?.message) {
      case 'ORDER_PAYMENT_METHOD_REQUIRED':
        return res.status(400).json({ error: 'Payment method is required' })
      case 'ORDER_IDS_REQUIRED':
        return res.status(400).json({ error: 'Order IDs are required' })
      case 'INTERNAL_CUSTOMER_NOT_FOUND':
        return res.status(404).json({ error: 'Internal customer not found' })
      default:
        return res.status(500).json({
          error: error?.message || 'Failed to pay selected internal customer orders',
        })
    }
  }
}

export async function getInternalCustomerPendingOrders(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const internalCustomerId = Array.isArray(req.params.internalCustomerId)
      ? req.params.internalCustomerId[0]
      : req.params.internalCustomerId

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await orderService.getInternalCustomerPendingOrders(
      companyId,
      internalCustomerId
    )

    return res.json(result)
  } catch (error: any) {
    console.error('getInternalCustomerPendingOrders error:', error)

    if (error?.message === 'INTERNAL_CUSTOMER_NOT_FOUND') {
      return res.status(404).json({ error: 'Internal customer not found' })
    }

    return res.status(500).json({
      error: error?.message || 'Failed to load internal customer pending orders',
    })
  }
}