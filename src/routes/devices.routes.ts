import { Router } from 'express'
import { deleteDevice, disconnectTerminal, heartbeat, listDevices } from '../controllers/devices.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.post('/heartbeat', requireAuth, heartbeat)
router.post('/terminal-disconnect', requireAuth, disconnectTerminal)
router.get('/', requireAuth, requirePermission('devices.view', 'settings.view'), listDevices)
router.delete('/:deviceId', requireAuth, requirePermission('devices.manage', 'settings.update'), deleteDevice)

export default router
