import { Router } from 'express'
import {
  login,
  logout,
  me,
  switchCompany,
  updateMe,
} from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

router.post('/login', login)
router.post('/logout', logout)
router.get('/me', requireAuth, me)
router.patch('/me', requireAuth, updateMe)
router.post('/switch-company', requireAuth, switchCompany)

export default router