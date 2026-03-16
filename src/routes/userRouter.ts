import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  checkEmail,
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updatePermissions,
  updateUser,
} from "../controllers/userController.js";

const router = Router();

// Listar / buscar — admin ou receptionist (service valida)
router.get("/users", requireAuth, asyncHandler(listUsers));
// router.get("/users", asyncHandler(listUsers));
router.get("/users/check-email/:email", requireAuth, asyncHandler(checkEmail));
router.get("/users/:id", requireAuth, asyncHandler(getUserById));

// Criar — admin only
router.post("/users", requireAuth, requireAdmin, asyncHandler(createUser));

// Editar — admin edita qualquer, user edita a si mesmo (service valida)
router.patch("/users/:id", requireAuth, asyncHandler(updateUser));
router.put("/users/:id", requireAuth, asyncHandler(updateUser));

// Permissões — admin only
router.patch("/users/:id/permissions", requireAuth, requireAdmin, asyncHandler(updatePermissions));

// Remover — admin only
router.delete("/users/:id", requireAuth, requireAdmin, asyncHandler(deleteUser));

export default router;
