import { Router } from 'express'
import {
  getReportsDashboardController,
  getReportsFiltersController,
} from '../controllers/reports.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/filters', requireAuth, requirePermission('reports.view'), getReportsFiltersController)
router.get('/dashboard', requireAuth, requirePermission('reports.view'), getReportsDashboardController)

export default router
