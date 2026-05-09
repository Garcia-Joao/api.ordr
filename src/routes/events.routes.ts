import { Router } from 'express'
import {
  cancelEventDateController,
  createEventDateController,
  createEventTemplateController,
  deleteEventDateController,
  deleteEventTemplateController,
  getEventDateController,
  getEventTemplateController,
  listCurrentEventDatesController,
  listEventDatesController,
  listEventPeopleController,
  listEventTemplatesController,
  updateEventDateController,
  updateEventDatePersonStatusController,
  updateEventTemplateController,
} from '../controllers/events.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/people', requireAuth, requirePermission('events.view'), listEventPeopleController)

router.get('/templates', requireAuth, requirePermission('events.view'), listEventTemplatesController)
router.get('/templates/:id', requireAuth, requirePermission('events.view'), getEventTemplateController)
router.post('/templates', requireAuth, requirePermission('events.manage'), createEventTemplateController)
router.patch('/templates/:id', requireAuth, requirePermission('events.manage'), updateEventTemplateController)
router.delete('/templates/:id', requireAuth, requirePermission('events.manage'), deleteEventTemplateController)

router.get('/dates', requireAuth, requirePermission('events.view', 'events.active.select', 'events.active.assign', 'customers.eventComanda.manage', 'pdv.view', 'orders.create', 'stock.quickBuy', 'buys.manage'), listEventDatesController)
router.get('/dates/current', requireAuth, requirePermission('events.view', 'events.active.select', 'events.active.assign', 'customers.eventComanda.manage', 'pdv.view', 'orders.create', 'stock.quickBuy', 'buys.manage'), listCurrentEventDatesController)
router.get('/dates/:id', requireAuth, requirePermission('events.view', 'events.active.select', 'events.active.assign', 'customers.eventComanda.manage'), getEventDateController)
router.post('/dates', requireAuth, requirePermission('events.manage'), createEventDateController)
router.patch('/dates/:id', requireAuth, requirePermission('events.manage'), updateEventDateController)
router.patch('/dates/:id/cancel', requireAuth, requirePermission('events.manage'), cancelEventDateController)
router.delete('/dates/:id', requireAuth, requirePermission('events.manage'), deleteEventDateController)

router.patch(
  '/dates/:id/people/:personId/status',
  requireAuth,
  requirePermission('events.manage'),
  updateEventDatePersonStatusController
)

export default router
