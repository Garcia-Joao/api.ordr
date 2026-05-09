import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import {
  createCompanyUser,
  createRole,
  deleteRole,
  getAssignableEventDates,
  getCompanyUsers,
  getPermissionCatalog,
  getRoles,
  updateCompanyUser,
  updateMyActiveEventDate,
  updateMembershipAccess,
  updateRole,
} from '../controllers/access.controller'

const router = Router()

router.get('/permissions', requireAuth, requirePermission('roles.view', 'roles.manage'), getPermissionCatalog)
router.get('/roles', requireAuth, requirePermission('roles.view', 'roles.manage', 'users.view', 'users.manage'), getRoles)
router.post('/roles', requireAuth, requirePermission('roles.manage'), createRole)
router.patch('/roles/:id', requireAuth, requirePermission('roles.manage'), updateRole)
router.delete('/roles/:id', requireAuth, requirePermission('roles.manage'), deleteRole)

router.get('/event-dates', requireAuth, requirePermission('users.manage', 'events.active.assign', 'events.manage'), getAssignableEventDates)
router.patch('/me/active-event', requireAuth, requirePermission('events.active.select', 'events.manage'), updateMyActiveEventDate)

router.get('/users', requireAuth, requirePermission('users.view', 'users.manage'), getCompanyUsers)
router.post('/users', requireAuth, requirePermission('users.manage'), createCompanyUser)
router.patch('/users/:id', requireAuth, requirePermission('users.manage'), updateCompanyUser)
router.patch('/users/:id/access', requireAuth, requirePermission('users.manage'), updateMembershipAccess)

export default router
