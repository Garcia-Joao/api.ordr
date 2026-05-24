import { Router } from 'express'
import {
  claimPrintJob,
  claimTerminalPrintPackage,
  updateTerminalPrintPackageStatus,
  createOrderPrintJobs,
  createPrintJob,
  deletePrintJob,
  listTerminalPendingJobs,
  updatePrintJobStatus,
} from '../controllers/print-jobs.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.post('/', requireAuth, createPrintJob)
router.post('/orders/:orderId', requireAuth, createOrderPrintJobs)
router.get('/terminal/pending', requireAuth, listTerminalPendingJobs)
router.post('/terminal/package/claim', requireAuth, claimTerminalPrintPackage)
router.patch('/terminal/package/status', requireAuth, updateTerminalPrintPackageStatus)
router.post('/:id/claim', requireAuth, claimPrintJob)
router.patch('/:id/status', requireAuth, updatePrintJobStatus)
router.delete('/:id', requireAuth, deletePrintJob)

export default router
