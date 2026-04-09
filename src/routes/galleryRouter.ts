import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  createGalleryImage,
  deleteGalleryImage,
  listGallery,
  updateGalleryImage,
} from "../controllers/galleryController.js";

const router = Router();

// Listar fotos — qualquer logado (exibido na Home)
router.get("/gallery", requireAuth, asyncHandler(listGallery));

// Upload / criar imagem — admin only
router.post("/gallery", requireAuth, requireAdmin, asyncHandler(createGalleryImage));

// Atualizar imagem — admin only
router.put("/gallery/:id", requireAuth, requireAdmin, asyncHandler(updateGalleryImage));

// Remover imagem — admin only
router.delete("/gallery/:id", requireAuth, requireAdmin, asyncHandler(deleteGalleryImage));

export default router;
