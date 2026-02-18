// src/routers/serviceRouter.ts
import { Router } from "express";
import {
  createService,
  deleteService,
  getServiceById,
  listServices,
  updateService,
} from "../controllers/serviceController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const route = Router();

// list / details: qualquer usuário logado da barbearia
route.get("/services", requireAuth, listServices);
route.get("/services/:id", requireAuth, getServiceById);

// create/update/delete: só admin
route.post("/services", requireAuth, requireAdmin, createService);
route.patch("/services/:id", requireAuth, requireAdmin, updateService);
route.delete("/services/:id", requireAuth, requireAdmin, deleteService);

export default route;
