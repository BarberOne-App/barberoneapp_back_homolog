import prisma from "../database/database.js";

function normalizeNullableString(value?: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/* ───── LIST ───── */
export async function listPlansInBarbershop(params: {
  barbershopId: string;
  activeOnly?: boolean;
}) {
  const where: any = { barbershop_id: params.barbershopId };
  if (params.activeOnly) where.active = true;

  return prisma.subscription_plans.findMany({
    where,
    orderBy: { price: "asc" },
    include: {
      subscription_plan_features: {
        orderBy: { sort_order: "asc" },
      },
    },
  });
}

/* ───── GET BY ID ───── */
export async function findPlanByIdInBarbershop(
  barbershopId: string,
  id: string
) {
  return prisma.subscription_plans.findFirst({
    where: { id, barbershop_id: barbershopId },
    include: {
      subscription_plan_features: {
        orderBy: { sort_order: "asc" },
      },
    },
  });
}

/* ───── CREATE (plan + features em transação) ───── */
export async function createPlanInBarbershop(data: {
  barbershopId: string;
  name: string;
  subtitle?: string | null;
  price: number;
  color?: string | null;
  cutsPerMonth: number;
  active?: boolean;
  recommended?: boolean;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  stripePaymentLinkUrl?: string | null;
  mpSubscriptionUrl?: string | null;
  mpPreapprovalPlanId?: string | null;
  features?: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.subscription_plans.create({
      data: {
        barbershop_id: data.barbershopId,
        name: data.name,
        subtitle: data.subtitle ?? null,
        price: data.price,
        color: data.color ?? null,
        cuts_per_month: data.cutsPerMonth,
        active: data.active ?? true,
        recommended: data.recommended ?? false,
        stripe_product_id: normalizeNullableString(data.stripeProductId),
        stripe_price_id: normalizeNullableString(data.stripePriceId),
        stripe_payment_link_url: normalizeNullableString(data.stripePaymentLinkUrl),
        mp_subscription_url: data.mpSubscriptionUrl ?? null,
        mp_preapproval_plan_id: normalizeNullableString(data.mpPreapprovalPlanId),
      },
    });

    if (data.features && data.features.length > 0) {
      await tx.subscription_plan_features.createMany({
        data: data.features.map((f, i) => ({
          plan_id: plan.id,
          feature: f,
          sort_order: i,
        })),
      });
    }

    return tx.subscription_plans.findUnique({
      where: { id: plan.id },
      include: {
        subscription_plan_features: { orderBy: { sort_order: "asc" } },
      },
    });
  });
}

/* ───── UPDATE (plan + replace features) ───── */
export async function updatePlanInBarbershop(
  barbershopId: string,
  id: string,
  data: {
    name?: string;
    subtitle?: string | null;
    price?: number;
    color?: string | null;
    cutsPerMonth?: number;
    active?: boolean;
    recommended?: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
    stripePaymentLinkUrl?: string | null;
    mpSubscriptionUrl?: string | null;
    mpPreapprovalPlanId?: string | null;
    features?: string[];
  }
) {
  // Verificar que pertence à barbearia
  const existing = await prisma.subscription_plans.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.cutsPerMonth !== undefined) updateData.cuts_per_month = data.cutsPerMonth;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.recommended !== undefined) updateData.recommended = data.recommended;
    if (data.stripeProductId !== undefined) {
      updateData.stripe_product_id = normalizeNullableString(data.stripeProductId);
    }
    if (data.stripePriceId !== undefined) {
      updateData.stripe_price_id = normalizeNullableString(data.stripePriceId);
    }
    if (data.stripePaymentLinkUrl !== undefined) {
      updateData.stripe_payment_link_url = normalizeNullableString(data.stripePaymentLinkUrl);
    }
    if (data.mpSubscriptionUrl !== undefined) updateData.mp_subscription_url = data.mpSubscriptionUrl;
    if (data.mpPreapprovalPlanId !== undefined) {
      updateData.mp_preapproval_plan_id = normalizeNullableString(data.mpPreapprovalPlanId);
    }
    updateData.updated_at = new Date();

    await tx.subscription_plans.update({
      where: { id },
      data: updateData,
    });

    // Se features foram enviadas, substituir todas
    if (data.features !== undefined) {
      await tx.subscription_plan_features.deleteMany({ where: { plan_id: id } });
      if (data.features.length > 0) {
        await tx.subscription_plan_features.createMany({
          data: data.features.map((f, i) => ({
            plan_id: id,
            feature: f,
            sort_order: i,
          })),
        });
      }
    }

    return tx.subscription_plans.findUnique({
      where: { id },
      include: {
        subscription_plan_features: { orderBy: { sort_order: "asc" } },
      },
    });
  });
}

/* ───── DELETE ───── */
export async function deletePlanFromBarbershop(barbershopId: string, id: string) {
  const existing = await prisma.subscription_plans.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  await prisma.subscription_plans.delete({ where: { id } });
  return existing;
}
