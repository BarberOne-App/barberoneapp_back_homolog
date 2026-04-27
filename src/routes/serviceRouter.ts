// src/routers/serviceRouter.ts
import { Router } from "express";
import {
  createService,
  deleteService,
  getServiceById,
  importServices,
  listServices,
  reactivateService,
  updateService,
} from "../controllers/serviceController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const route = Router();

// list / details
route.get("/services", requireAuth, asyncHandler(listServices));
route.get("/services/:id", requireAuth, asyncHandler(getServiceById));

// create / update / deactivate / reactivate
route.post("/services", requireAuth, requireAdmin, asyncHandler(createService));
route.post("/services/import", requireAuth, requireAdmin, asyncHandler(importServices));
route.patch("/services/:id", requireAuth, requireAdmin, asyncHandler(updateService));
route.patch(
  "/services/:id/reactivate",
  requireAuth,
  requireAdmin,
  asyncHandler(reactivateService)
);
route.delete("/services/:id", requireAuth, requireAdmin, asyncHandler(deleteService));

export default route;