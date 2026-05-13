import { Router } from 'express'
import {
  adminAssignCompanyLicenseController,
  adminCreateCompanyController,
  adminCreateLicensePlanController,
  adminCreateUserController,
  adminDeleteCompanyController,
  adminDeleteCompanyLicenseController,
  adminDeleteCompanyMembershipController,
  adminDeleteLicensePlanController,
  adminDeleteUserController,
  adminGetCompanyController,
  adminListCompaniesController,
  adminListLicensePlansController,
  adminListUsersController,
  adminLoginController,
  adminLogoutController,
  adminMeController,
  adminUpdateCompanyAccessController,
  adminUpdateCompanyController,
  adminUpdateCompanyLicenseController,
  adminUpdateCompanyMembershipController,
  adminUpdateLicensePlanController,
  adminUpsertCompanyMembershipController,
} from '../controllers/admin.controller'
import { requirePlatformAdmin } from '../middleware/admin-auth.middleware'

const adminRouter = Router()

adminRouter.post('/auth/login', adminLoginController)
adminRouter.post('/auth/logout', adminLogoutController)
adminRouter.get('/auth/me', requirePlatformAdmin, adminMeController)

adminRouter.get('/users', requirePlatformAdmin, adminListUsersController)
adminRouter.post('/users', requirePlatformAdmin, adminCreateUserController)
adminRouter.delete('/users/:userId', requirePlatformAdmin, adminDeleteUserController)

adminRouter.get('/license-plans', requirePlatformAdmin, adminListLicensePlansController)
adminRouter.post('/license-plans', requirePlatformAdmin, adminCreateLicensePlanController)
adminRouter.put('/license-plans/:id', requirePlatformAdmin, adminUpdateLicensePlanController)
adminRouter.delete('/license-plans/:id', requirePlatformAdmin, adminDeleteLicensePlanController)

adminRouter.get('/companies', requirePlatformAdmin, adminListCompaniesController)
adminRouter.post('/companies', requirePlatformAdmin, adminCreateCompanyController)
adminRouter.get('/companies/:companyId', requirePlatformAdmin, adminGetCompanyController)
adminRouter.patch('/companies/:companyId', requirePlatformAdmin, adminUpdateCompanyController)
adminRouter.delete('/companies/:companyId', requirePlatformAdmin, adminDeleteCompanyController)
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
adminRouter.patch(
  '/company-licenses/:licenseId',
  requirePlatformAdmin,
  adminUpdateCompanyLicenseController
)
adminRouter.delete(
  '/company-licenses/:licenseId',
  requirePlatformAdmin,
  adminDeleteCompanyLicenseController
)

adminRouter.post('/company-memberships', requirePlatformAdmin, adminUpsertCompanyMembershipController)
adminRouter.patch('/company-memberships/:membershipId', requirePlatformAdmin, adminUpdateCompanyMembershipController)
adminRouter.delete('/company-memberships/:membershipId', requirePlatformAdmin, adminDeleteCompanyMembershipController)

export default adminRouter
