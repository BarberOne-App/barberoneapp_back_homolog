// src/controllers/serviceController.ts
import { Request, Response } from "express";
import {
  CreateServiceSchema,
  ListServicesQuerySchema,
  ServiceIdParamSchema,
  UpdateServiceSchema,
} from "../models/serviceSchema.js";
import {
  createServiceService,
  deleteServiceService,
  getServiceByIdService,
  listServicesService,
  updateServiceService,
} from "../services/serviceService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function createService(req: Request, res: Response) {
  const { error, value } = CreateServiceSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  // const barbershopId = req.user!.barbershopId;
  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const created = await createServiceService(barbershopId, {
    name: value.name,
    basePrice: value.basePrice,
    durationMinutes: value.durationMinutes,
    comissionPercent: value.commissionPercent ?? null,
    imageUrl: value.imageUrl ?? null,
    active: value.active,
    promotionalPrice: value.promotionalPrice ?? 0,
    covered_by_plan: value.covered_by_plan ?? false,
  });

  return res.status(201).send(created);
}

export async function listServices(req: Request, res: Response) {
  const { error, value } = ListServicesQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  // const barbershopId = req.user!.barbershopId;
  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await listServicesService({
    barbershopId,
    // isAdmin: req.user!.isAdmin || req.user!.role === "admin",
    isAdmin: true,
    q: value.q,
    includeInactive: value.includeInactive,
    page: value.page,
    limit: value.limit,
  });

  return res.status(200).send(result);
}

export async function getServiceById(req: Request, res: Response) {
  const { error } = ServiceIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  // const barbershopId = req.user!.barbershopId;
  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const service = await getServiceByIdService({
    barbershopId,
    id: req.params.id,
    isAdmin: req.user!.isAdmin || req.user!.role === "admin",
  });

  if (!service) return res.status(404).send(["Serviço não encontrado"]);
  return res.status(200).send(service);
}

export async function updateService(req: Request, res: Response) {
  const p = ServiceIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdateServiceSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';
  // const barbershopId = '77faab94-26fd-48f0-aef7-8ddab4b35a94';

  const updated = await updateServiceService({
    barbershopId,
    id: req.params.id,
    data: {
      name: b.value.name,
      basePrice: b.value.basePrice,
      durationMinutes: b.value.durationMinutes,
      comissionPercent: b.value.commissionPercent ?? null,
      promotionalPrice: b.value.promotionalPrice,
      covered_by_plan: b.value.covered_by_plan,
      imageUrl: b.value.imageUrl,
      active: b.value.active,
    },
  });

  if (!updated) return res.status(404).send(["Serviço não encontrado"]);
  return res.status(200).send(updated);
}

export async function deleteService(req: Request, res: Response) {
  const { error } = ServiceIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  // const barbershopId = req.user!.barbershopId;
  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const deleted = await deleteServiceService(barbershopId, req.params.id);
  if (!deleted) return res.status(404).send(["Serviço não encontrado"]);

  return res.status(200).send({ ok: true });
}
