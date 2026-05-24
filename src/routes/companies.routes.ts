import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import { createTestCompany, deleteTestCompany, getPdvSettings, updatePdvSettings } from '../controllers/companies.controller'

const router = Router()


router.get(
  '/pdv-settings',
  requireAuth,
  requirePermission('settings.view', 'settings.update', 'pdv.view'),
  getPdvSettings
)

router.put(
  '/pdv-settings',
  requireAuth,
  requirePermission('settings.update'),
  updatePdvSettings
)

router.post(
  '/create-test-company',
  requireAuth,
  requirePermission('settings.update'),
  createTestCompany
)

router.delete(
  '/test-company/:companyId',
  requireAuth,
  deleteTestCompany
)

export default router
