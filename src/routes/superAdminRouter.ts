import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireSuperAdmin } from "../middleware/authMiddleware.js";
import {
  getSuperAdminBarbershopById,
  getSuperAdminDashboard,
  listSuperAdminBarbershops,
  listSuperAdminUsers,
  listSuperAdminBarbershopUsers,
  updateSuperAdminUser,
  updateSuperAdminBarbershopStatus,
  resetUserPassword,
  listPlatformPlansController,
  createPlatformPlanController,
} from "../controllers/superAdminController.js";

const router = Router();

router.get(
  "/super-admin/dashboard",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(getSuperAdminDashboard)
);

router.get(
  "/super-admin/barbershops",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(listSuperAdminBarbershops)
);

router.get(
  "/super-admin/barbershops/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(getSuperAdminBarbershopById)
);

router.get(
  "/super-admin/barbershops/:id/users",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(listSuperAdminBarbershopUsers)
);

router.patch(
  "/super-admin/barbershops/:id/status",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(updateSuperAdminBarbershopStatus)
);

router.get(
  "/super-admin/users",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(listSuperAdminUsers)
);

router.patch(
  "/super-admin/users/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(updateSuperAdminUser)
);

router.patch(
  '/super-admin/users/:id/password',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(resetUserPassword)
);

router.get(
    '/platform-plans',
    requireAuth,
    requireSuperAdmin,
    listPlatformPlansController
);

router.post(
    '/platform-plans',
    requireAuth,
    requireSuperAdmin,
    createPlatformPlanController
);

export default router;
