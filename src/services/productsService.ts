import { Prisma } from "@prisma/client";
import { forbidden, notFound } from "../errors/index.js";
import {
    createProduct,
    deleteProductById,
    findProductByIdInBarbershop,
    listProductsInBarbershop,
    updateProductInBarbershop,
} from "../repository/productsRepository.js";

export async function createProductService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client";
    data: {
        name: string;
        description?: string | null;
        category?: string | null;
        price: number;
        subscriberDiscount?: number;
        imageUrl?: string | null;
        stock?: number;
        active?: boolean;
    };
}) {
    if (params.actorRole !== "admin") throw forbidden("Apenas admin pode criar produto");

    return createProduct({
        barbershopId: params.barbershopId,
        name: params.data.name.trim(),
        description: params.data.description ?? null,
        category: params.data.category ?? null,
        price: new Prisma.Decimal(params.data.price),
        subscriberDiscount: params.data.subscriberDiscount ?? 0,
        imageUrl: params.data.imageUrl ?? null,
        stock: params.data.stock ?? 0,
        active: params.data.active ?? true,
    });
}

export async function listProductsService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client";
    query?: { active?: boolean; category?: string; q?: string };
}) {
    // se não for admin, força active=true (a não ser que você queira permitir ver inativos)
    const active =
        params.actorRole === "admin" ? params.query?.active : true;

    console.log('params', params);
    return listProductsInBarbershop({
        barbershopId: params.barbershopId,
        active,
        category: params.query?.category,
        q: params.query?.q,
    });
}

export async function getProductByIdService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client";
    productId: string;
}) {
    const product = await findProductByIdInBarbershop(params.barbershopId, params.productId);
    if (!product) throw notFound("Produto não encontrado");

    // se não for admin, não deixa pegar inativo
    if (params.actorRole !== "admin" && !product.active) throw notFound("Produto não encontrado");

    return product;
}

export async function updateProductService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client";
    productId: string;
    data: {
        name?: string;
        description?: string | null;
        category?: string | null;
        price?: number;
        subscriberDiscount?: number;
        imageUrl?: string | null;
        stock?: number;
        active?: boolean;
    };
}) {
    if (params.actorRole !== "admin") throw forbidden("Apenas admin pode editar produto");

    const existing = await findProductByIdInBarbershop(params.barbershopId, params.productId);
    if (!existing) throw notFound("Produto não encontrado");

    const data: Prisma.productsUpdateInput = {};

    if (params.data.name !== undefined) data.name = params.data.name.trim();
    if (params.data.description !== undefined) data.description = params.data.description ?? null;
    if (params.data.category !== undefined) data.category = params.data.category ?? null;
    if (params.data.price !== undefined) data.price = new Prisma.Decimal(params.data.price);
    if (params.data.subscriberDiscount !== undefined) data.subscriber_discount = params.data.subscriberDiscount;
    if (params.data.imageUrl !== undefined) data.image_url = params.data.imageUrl ?? null;
    if (params.data.stock !== undefined) data.stock = params.data.stock;
    if (params.data.active !== undefined) data.active = params.data.active;

    return updateProductInBarbershop(params.barbershopId, params.productId, data);
}

export async function deleteProductService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client";
    productId: string;
}) {
    if (params.actorRole !== "admin") throw forbidden("Apenas admin pode remover produto");

    const existing = await findProductByIdInBarbershop(params.barbershopId, params.productId);
    if (!existing) throw notFound("Produto não encontrado");

    await deleteProductById(params.productId);
    return { ok: true };
}
