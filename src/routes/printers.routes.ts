import { Router } from 'express'
import {
  getSystemPrinters,
  getPrinterSettings,
  savePrinterSettings,
  testPrinter,
} from '../controllers/printers.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/system', requireAuth, requirePermission('printers.view'), getSystemPrinters)
router.get('/settings', requireAuth, requirePermission('printers.view'), getPrinterSettings)
router.put('/settings', requireAuth, requirePermission('printers.update'), savePrinterSettings)
router.post('/test', requireAuth, requirePermission('printers.test'), testPrinter)

export default router
