import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import { createTestCompany } from '../controllers/companies.controller'

const router = Router()

router.post(
  '/create-test-company',
  requireAuth,
  requirePermission('settings.update'),
  createTestCompany
)

export default router
