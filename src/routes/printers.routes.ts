import { Router } from 'express'
import {
  bindPrintPort,
  createPrintPort,
  deletePrintPort,
  getPrinterSettings,
  getPrintTerminals,
  getSystemPrinters,
  listPrintPorts,
  savePrinterSettings,
  setPrintPortBindings,
  testPrinter,
  updatePrintPort,
} from '../controllers/printers.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/system', requireAuth, requirePermission('printers.view'), getSystemPrinters)
router.get('/settings', requireAuth, requirePermission('printers.view'), getPrinterSettings)
router.put('/settings', requireAuth, requirePermission('printers.update'), savePrinterSettings)
router.post('/test', requireAuth, requirePermission('printers.test'), testPrinter)

router.get('/terminals', requireAuth, requirePermission('printers.view'), getPrintTerminals)
router.get('/ports', requireAuth, requirePermission('printers.view'), listPrintPorts)
router.post('/ports', requireAuth, requirePermission('printers.update'), createPrintPort)
router.put('/ports/:id', requireAuth, requirePermission('printers.update'), updatePrintPort)
router.patch('/ports/:id/binding', requireAuth, requirePermission('printers.update'), bindPrintPort)
router.patch('/ports/:id/bindings', requireAuth, requirePermission('printers.update'), setPrintPortBindings)
router.delete('/ports/:id', requireAuth, requirePermission('printers.update'), deletePrintPort)

export default router
