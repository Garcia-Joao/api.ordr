import { Router } from 'express'
import {
  createTerminalLaunchToken,
  login,
  logout,
  me,
  switchCompany,
  terminalLogin,
  updateMe,
} from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.post('/login', login)
router.post('/logout', logout)
router.get('/me', requireAuth, me)
router.patch('/me', requireAuth, updateMe)
router.post('/switch-company', requireAuth, switchCompany)

router.post('/terminal-launch-token', requireAuth, createTerminalLaunchToken)
router.post('/terminal-login', terminalLogin)

export default router
