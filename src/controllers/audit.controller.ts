import { Request, Response } from 'express'
import * as auditService from '../services/audit.service'

function getCompanyId(req: Request) {
  return (req.headers['x-company-id'] as string | undefined) || req.user?.companyId
}

export async function listAuditLogs(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    if (!companyId) return res.status(400).json({ error: 'companyId is required' })

    const result = await auditService.listAuditLogs({
      companyId,
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      entityType:
        typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
      userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      take: req.query.take ? Number(req.query.take) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    })

    return res.json(result)
  } catch (error: any) {
    console.error('listAuditLogs error:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao listar auditoria' })
  }
}
