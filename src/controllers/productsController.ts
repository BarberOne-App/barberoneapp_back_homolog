import { Request, Response } from "express";
import { CreateProductSchema, ListProductsQuerySchema, UpdateProductSchema } from "../models/productSchemas.js";
import {
    createProductService,
    deleteProductService,
    getProductByIdService,
    listProductsService,
    updateProductService,
} from "../services/productsService.js";

function joiErrors(error: any) {
    return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function createProduct(req: Request, res: Response) {
    const { error } = CreateProductSchema.validate(req.body);
    if (error) return res.status(422).send(joiErrors(error));

    const result = await createProductService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role,
        data: req.body,
    });

    return res.status(201).send(result);
}

export async function listProducts(req: Request, res: Response) {
    const { error } = ListProductsQuerySchema.validate(req.query);
    if (error) return res.status(422).send(joiErrors(error));

    // query vem string, então normaliza aqui
    const active =
        typeof req.query.active === "string" ? req.query.active === "true" : undefined;

    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    const result = await listProductsService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role,
        query: { active, category, q },
    });

    return res.status(200).send(result);
}

export async function getProductById(req: Request, res: Response) {
    const { id } = req.params;

    const result = await getProductByIdService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role,
        productId: id,
    });

    return res.status(200).send(result);
}

export async function updateProduct(req: Request, res: Response) {
    const { id } = req.params;

    const { error } = UpdateProductSchema.validate(req.body);
    if (error) return res.status(422).send(joiErrors(error));

    const result = await updateProductService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role,
        productId: id,
        data: req.body,
    });

    return res.status(200).send(result);
}

export async function deleteProduct(req: Request, res: Response) {
    const { id } = req.params;

    const result = await deleteProductService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role,
        productId: id,
    });

    return res.status(200).send(result);
}
