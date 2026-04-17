import { Request, Response } from "express";
import {
  CreateProductSchema,
  ImportProductsSchema,
  ListProductsQuerySchema,
  UpdateProductSchema,
} from "../models/productSchemas.js";
import {
  createProductService,
  deleteProductService,
  getProductByIdService,
  importProductsService,
  listProductsService,
  reactivateProductService,
  updateProductService,
} from "../services/productsService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function createProduct(req: Request, res: Response) {
  const { error } = CreateProductSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createProductService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    data: req.body,
  });

  return res.status(201).send(result);
}

export async function importProducts(req: Request, res: Response) {
  const { error, value } = ImportProductsSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await importProductsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    rows: value.rows,
  });

  return res.status(201).send(result);
}

export async function listProducts(req: Request, res: Response) {
  const { error } = ListProductsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const active =
    typeof req.query.active === "string"
      ? req.query.active === "true"
      : undefined;

  const category =
    typeof req.query.category === "string" ? req.query.category : undefined;

  const q = typeof req.query.q === "string" ? req.query.q : undefined;

  const result = await listProductsService({
    barbershopId: "29f85580-2fb7-497d-b331-67bcc4da25e1",
    actorRole: req.user!.role,
    query: { active, category, q },
  });

  return res.status(200).send(result);
}

export async function getProductById(req: Request, res: Response) {
  const { id } = req.params;

  const result = await getProductByIdService({
    barbershopId: "29f85580-2fb7-497d-b331-67bcc4da25e1",
    actorRole: req.user!.role,
    productId: id,
  });

  return res.status(200).send(result);
}

export async function updateProduct(req: Request, res: Response) {
  const { id } = req.params;

  const { error } = UpdateProductSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await updateProductService({
    barbershopId: "29f85580-2fb7-497d-b331-67bcc4da25e1",
    actorRole: req.user!.role,
    productId: id,
    data: req.body,
  });

  return res.status(200).send(result);
}

export async function deleteProduct(req: Request, res: Response) {
  const { id } = req.params;

  const result = await deleteProductService({
    barbershopId: "29f85580-2fb7-497d-b331-67bcc4da25e1",
    actorRole: req.user!.role,
    productId: id,
  });

  return res.status(200).send(result);
}

export async function reactivateProduct(req: Request, res: Response) {
  const { id } = req.params;

  const result = await reactivateProductService({
    barbershopId: "29f85580-2fb7-497d-b331-67bcc4da25e1",
    actorRole: req.user!.role,
    productId: id,
  });

  return res.status(200).send(result);
}