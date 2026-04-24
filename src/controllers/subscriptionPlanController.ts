import { Request, Response } from "express";
import {
  CreatePlanSchema,
  ListPlansQuerySchema,
  PlanIdParamSchema,
  UpdatePlanSchema,
} from "../models/subscriptionPlanSchemas.js";
import {
  createPlanService,
  deletePlanService,
  getPlanByIdService,
  listPlansService,
  updatePlanService,
} from "../services/subscriptionPlanService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

function normalizePlanPayload(body: any) {
  const mpPreapprovalPlanId =
    body?.mpPreapprovalPlanId ??
    body?.mp_preapproval_plan_id ??
    body?.mp_preapproval_id ??
    body?.productId ??
    undefined;

  const stripeProductId =
    body?.stripeProductId ??
    body?.stripe_product_id ??
    undefined;

  const stripePriceId =
    body?.stripePriceId ??
    body?.stripe_price_id ??
    undefined;

  const stripePaymentLinkUrl =
    body?.stripePaymentLinkUrl ??
    body?.stripe_payment_link_url ??
    body?.subscriptionUrl ??
    undefined;

  const syncStripe =
    body?.syncStripe ??
    body?.autoCreateStripe ??
    body?.createOnStripe ??
    undefined;

  return {
    ...body,
    ...(stripeProductId !== undefined ? { stripeProductId } : {}),
    ...(stripePriceId !== undefined ? { stripePriceId } : {}),
    ...(stripePaymentLinkUrl !== undefined ? { stripePaymentLinkUrl } : {}),
    ...(syncStripe !== undefined ? { syncStripe } : {}),
    ...(mpPreapprovalPlanId !== undefined ? { mpPreapprovalPlanId } : {}),
  };
}

/* ───── LIST ───── */
export async function listPlans(req: Request, res: Response) {
  const { error, value } = ListPlansQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listPlansService({
    barbershopId: req.user!.barbershopId,
    activeOnly: value.activeOnly,
  });

  return res.status(200).send(result);
}

/* ───── GET BY ID ───── */
export async function getPlanById(req: Request, res: Response) {
  const { error } = PlanIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await getPlanByIdService({
    barbershopId: req.user!.barbershopId,
    planId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createPlan(req: Request, res: Response) {
  const normalizedBody = normalizePlanPayload(req.body);
  const { error, value } = CreatePlanSchema.validate(normalizedBody);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createPlanService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── UPDATE ───── */
export async function updatePlan(req: Request, res: Response) {
  const p = PlanIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const normalizedBody = normalizePlanPayload(req.body);
  const b = UpdatePlanSchema.validate(normalizedBody, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await updatePlanService({
    barbershopId: req.user!.barbershopId,
    planId: req.params.id,
    data: b.value,
  });

  return res.status(200).send(result);
}

/* ───── DELETE ───── */
export async function deletePlan(req: Request, res: Response) {
  const { error } = PlanIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await deletePlanService({
    barbershopId: req.user!.barbershopId,
    planId: req.params.id,
  });

  return res.status(200).send(result);
}
