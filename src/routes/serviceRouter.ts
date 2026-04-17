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

const route = Router();

// list / details
route.get("/services", listServices);
route.get("/services/:id", getServiceById);

// create / update / deactivate / reactivate
route.post("/services", requireAuth, requireAdmin, createService);
route.post("/services/import", requireAuth, requireAdmin, importServices);
route.patch("/services/:id", requireAuth, requireAdmin, updateService);
route.patch("/services/:id/reactivate", requireAuth, requireAdmin, reactivateService);
route.delete("/services/:id", requireAuth, requireAdmin, deleteService);

export default route;