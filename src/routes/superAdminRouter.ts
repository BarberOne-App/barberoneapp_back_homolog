import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireSuperAdmin } from "../middleware/authMiddleware.js";
import {
  getSuperAdminBarbershopById,
  getSuperAdminDashboard,
  listSuperAdminBarbershops,
  listSuperAdminBarbershopUsers,
  updateSuperAdminBarbershopStatus,
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

export default router;
