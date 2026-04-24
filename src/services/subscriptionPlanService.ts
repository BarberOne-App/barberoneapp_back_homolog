import { notFound } from "../errors/index.js";
import {
  createPlanInBarbershop,
  findPlanByIdInBarbershop,
  deletePlanFromBarbershop,
  listPlansInBarbershop,
  updatePlanInBarbershop,
} from "../repository/subscriptionPlanRepository.js";
import { provisionConnectRecurringPlan } from "./stripeConnectPlanService.js";

/* ─────────────── helpers ─────────────── */

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

function serialize(plan: any) {
  return {
    id: plan.id,
    barbershopId: plan.barbershop_id,
    name: plan.name,
    subtitle: plan.subtitle,
    price: decimalToNumber(plan.price),
    color: plan.color,
    cutsPerMonth: plan.cuts_per_month,
    active: plan.active,
    recommended: plan.recommended,
    stripeProductId: plan.stripe_product_id,
    stripePriceId: plan.stripe_price_id,
    stripePaymentLinkUrl: plan.stripe_payment_link_url,
    mpSubscriptionUrl: plan.stripe_payment_link_url || plan.mp_subscription_url,
    mpPreapprovalPlanId: plan.stripe_product_id || plan.mp_preapproval_plan_id,
    subscriptionUrl: plan.stripe_payment_link_url || plan.mp_subscription_url,
    externalPlanId: plan.stripe_product_id || plan.mp_preapproval_plan_id,
    features: (plan.subscription_plan_features ?? []).map((f: any) => f.feature),
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  };
}

/* ───────── LIST ───────── */
export async function listPlansService(params: {
  barbershopId: string;
  activeOnly?: boolean;
}) {
  const items = await listPlansInBarbershop({
    barbershopId: params.barbershopId,
    activeOnly: params.activeOnly,
  });
  return items.map(serialize);
}

/* ───────── GET BY ID ───────── */
export async function getPlanByIdService(params: {
  barbershopId: string;
  planId: string;
}) {
  const plan = await findPlanByIdInBarbershop(params.barbershopId, params.planId);
  if (!plan) throw notFound("Plano não encontrado");
  return serialize(plan);
}

/* ───────── CREATE ───────── */
export async function createPlanService(params: {
  barbershopId: string;
  data: {
    name: string;
    subtitle?: string | null;
    price: number;
    color?: string | null;
    cutsPerMonth: number;
    active?: boolean;
    recommended?: boolean;
    syncStripe?: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
    stripePaymentLinkUrl?: string | null;
    mpSubscriptionUrl?: string | null;
    mpPreapprovalPlanId?: string | null;
    features?: string[];
  };
}) {
  const { syncStripe, ...dataToPersist } = params.data;

  let stripeData:
    | {
        stripeProductId: string;
        stripePriceId: string;
        stripePaymentLinkUrl: string;
      }
    | undefined;

  if (syncStripe !== false) {
    stripeData = await provisionConnectRecurringPlan({
      barbershopId: params.barbershopId,
      planName: dataToPersist.name,
      amount: dataToPersist.price,
    });
  }

  const created = await createPlanInBarbershop({
    barbershopId: params.barbershopId,
    ...dataToPersist,
    stripeProductId: stripeData?.stripeProductId,
    stripePriceId: stripeData?.stripePriceId,
    stripePaymentLinkUrl: stripeData?.stripePaymentLinkUrl,
  });
  return serialize(created);
}

/* ───────── UPDATE ───────── */
export async function updatePlanService(params: {
  barbershopId: string;
  planId: string;
  data: {
    name?: string;
    subtitle?: string | null;
    price?: number;
    color?: string | null;
    cutsPerMonth?: number;
    active?: boolean;
    recommended?: boolean;
    syncStripe?: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
    stripePaymentLinkUrl?: string | null;
    mpSubscriptionUrl?: string | null;
    mpPreapprovalPlanId?: string | null;
    features?: string[];
  };
}) {
  const { syncStripe, ...dataToPersist } = params.data;

  const existing = await findPlanByIdInBarbershop(params.barbershopId, params.planId);
  if (!existing) throw notFound("Plano não encontrado");

  const shouldSyncStripe =
    syncStripe !== false &&
    (dataToPersist.name !== undefined ||
      dataToPersist.price !== undefined ||
      !existing.stripe_product_id ||
      !existing.stripe_price_id ||
      !existing.stripe_payment_link_url);

  let stripeData:
    | {
        stripeProductId: string;
        stripePriceId: string;
        stripePaymentLinkUrl: string;
      }
    | undefined;

  if (shouldSyncStripe) {
    stripeData = await provisionConnectRecurringPlan({
      barbershopId: params.barbershopId,
      planName: dataToPersist.name ?? existing.name,
      amount: dataToPersist.price ?? decimalToNumber(existing.price),
      existingProductId: existing.stripe_product_id,
    });
  }

  const updated = await updatePlanInBarbershop(
    params.barbershopId,
    params.planId,
    {
      ...dataToPersist,
      stripeProductId: stripeData?.stripeProductId,
      stripePriceId: stripeData?.stripePriceId,
      stripePaymentLinkUrl: stripeData?.stripePaymentLinkUrl,
    }
  );
  if (!updated) throw notFound("Plano não encontrado");
  return serialize(updated);
}

/* ───────── DELETE ───────── */
export async function deletePlanService(params: {
  barbershopId: string;
  planId: string;
}) {
  const deleted = await deletePlanFromBarbershop(params.barbershopId, params.planId);
  if (!deleted) throw notFound("Plano não encontrado");
  return { message: "Plano removido com sucesso" };
}
