import { Request, Response } from 'express'
import * as service from '../services/print-jobs.service'

type AuthRequest = Request & { user?: { id: string; companyId: string } }

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || ''
}

function handleError(res: Response, error: any) {
  const message = error?.message || 'Erro de impressão.'
  if (['PRINT_PORT_NOT_FOUND', 'ORDER_NOT_FOUND', 'PRINT_JOB_NOT_FOUND'].includes(message)) {
    return res.status(404).json({ error: message })
  }
  if (['PRINT_PORT_NOT_BOUND', 'PRINT_TERMINAL_NOT_AVAILABLE', 'PRINT_TERMINAL_NOT_FOUND'].includes(message)) {
    return res.status(400).json({ error: message })
  }
  return res.status(500).json({ error: message })
}

export async function createPrintJob(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const job = await service.createPrintJob({ companyId, ...req.body })
    return res.status(201).json({ job })
  } catch (error: any) {
    console.error('create print job error:', error)
    return handleError(res, error)
  }
}

export async function createOrderPrintJobs(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const orderId = param(req.params.orderId)
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })

    const jobs = await service.createOrderPrintJobs(companyId, orderId)
    return res.status(201).json({ jobs })
  } catch (error: any) {
    console.error('create order print jobs error:', error)
    return handleError(res, error)
  }
}

export async function listTerminalPendingJobs(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const terminalDeviceId = String(req.query.terminalDeviceId ?? '')
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    if (!terminalDeviceId) return res.status(400).json({ error: 'terminalDeviceId é obrigatório.' })

    const jobs = await service.listTerminalPendingJobs(companyId, terminalDeviceId)
    return res.json({ jobs })
  } catch (error: any) {
    console.error('list terminal pending jobs error:', error)
    return handleError(res, error)
  }
}

export async function claimPrintJob(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const terminalDeviceId = String(req.body?.terminalDeviceId ?? '')
    const jobId = param(req.params.id)
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    if (!terminalDeviceId) return res.status(400).json({ error: 'terminalDeviceId é obrigatório.' })

    const job = await service.claimPrintJob(companyId, terminalDeviceId, jobId)
    return res.json({ job })
  } catch (error: any) {
    console.error('claim print job error:', error)
    return handleError(res, error)
  }
}

export async function updatePrintJobStatus(req: AuthRequest, res: Response) {
  try {
    const companyId = req.user?.companyId
    const terminalDeviceId = String(req.body?.terminalDeviceId ?? '')
    const status = String(req.body?.status ?? '') as any
    const jobId = param(req.params.id)
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' })
    if (!terminalDeviceId || !status) return res.status(400).json({ error: 'terminalDeviceId e status são obrigatórios.' })

    const job = await service.updatePrintJobStatus(companyId, terminalDeviceId, jobId, status, req.body?.errorMessage ?? null)
    return res.json({ job })
  } catch (error: any) {
    console.error('update print job status error:', error)
    return handleError(res, error)
  }
}
