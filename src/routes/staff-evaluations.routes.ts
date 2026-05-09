import { Router } from 'express'
import {
  createStaffEvaluationCriterionController,
  getPeopleEvaluationRatingsController,
  getPersonEvaluationSummaryController,
  listEventStaffForReviewController,
  listStaffEvaluationCriteriaController,
  saveStaffEvaluationController,
} from '../controllers/staff-evaluations.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'

const router = Router()

router.get('/criteria', requireAuth, requirePermission('staffEvaluations.view'), listStaffEvaluationCriteriaController)
router.post('/criteria', requireAuth, requirePermission('staffEvaluations.manage'), createStaffEvaluationCriterionController)

router.get('/events/:eventDateId/staff', requireAuth, requirePermission('staffEvaluations.view'), listEventStaffForReviewController)
router.post('/events/:eventDateId/staff/evaluations', requireAuth, requirePermission('staffEvaluations.manage'), saveStaffEvaluationController)

router.get('/people/ratings', requireAuth, requirePermission('staffEvaluations.view'), getPeopleEvaluationRatingsController)
router.get('/people/:personId/summary', requireAuth, requirePermission('staffEvaluations.view'), getPersonEvaluationSummaryController)

export default router
