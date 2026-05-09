import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import { listAuditLogs } from '../controllers/audit.controller'

const router = Router()

router.get('/', requireAuth, requirePermission('audit.view'), listAuditLogs)

export default router
