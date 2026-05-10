import { Router } from 'express'
import { deleteDevice, heartbeat, listDevices } from '../controllers/devices.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.post('/heartbeat', requireAuth, heartbeat)
router.get('/', requireAuth, requirePermission('settings.view'), listDevices)
router.delete('/:deviceId', requireAuth, requirePermission('settings.view'), deleteDevice)

export default router
