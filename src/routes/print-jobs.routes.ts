import { Router } from 'express'
import {
  claimPrintJob,
  createOrderPrintJobs,
  createPrintJob,
  listTerminalPendingJobs,
  updatePrintJobStatus,
} from '../controllers/print-jobs.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.post('/', requireAuth, createPrintJob)
router.post('/orders/:orderId', requireAuth, createOrderPrintJobs)
router.get('/terminal/pending', requireAuth, listTerminalPendingJobs)
router.post('/:id/claim', requireAuth, claimPrintJob)
router.patch('/:id/status', requireAuth, updatePrintJobStatus)

export default router
