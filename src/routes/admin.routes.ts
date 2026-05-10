import { Router } from 'express'
import {
  adminAssignCompanyLicenseController,
  adminCreateCompanyController,
  adminCreateLicensePlanController,
  adminCreateUserController,
  adminGetCompanyController,
  adminListCompaniesController,
  adminListLicensePlansController,
  adminLoginController,
  adminLogoutController,
  adminMeController,
  adminUpdateCompanyAccessController,
  adminUpdateLicensePlanController,
} from '../controllers/admin.controller'
import { requirePlatformAdmin } from '../middleware/admin-auth.middleware'

const adminRouter = Router()

adminRouter.post('/auth/login', adminLoginController)
adminRouter.post('/auth/logout', adminLogoutController)
adminRouter.get('/auth/me', requirePlatformAdmin, adminMeController)

adminRouter.post('/users', requirePlatformAdmin, adminCreateUserController)

adminRouter.get('/license-plans', requirePlatformAdmin, adminListLicensePlansController)
adminRouter.post('/license-plans', requirePlatformAdmin, adminCreateLicensePlanController)
adminRouter.put('/license-plans/:id', requirePlatformAdmin, adminUpdateLicensePlanController)

adminRouter.get('/companies', requirePlatformAdmin, adminListCompaniesController)
adminRouter.post('/companies', requirePlatformAdmin, adminCreateCompanyController)
adminRouter.get('/companies/:companyId', requirePlatformAdmin, adminGetCompanyController)
adminRouter.patch(
  '/companies/:companyId/access',
  requirePlatformAdmin,
  adminUpdateCompanyAccessController
)
adminRouter.post(
  '/companies/:companyId/license',
  requirePlatformAdmin,
  adminAssignCompanyLicenseController
)

export default adminRouter