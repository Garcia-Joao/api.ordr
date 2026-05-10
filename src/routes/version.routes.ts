import { Router } from 'express'
import { versionCheck } from '../controllers/version.controller'

const router = Router()

router.get('/', versionCheck)

export default router
