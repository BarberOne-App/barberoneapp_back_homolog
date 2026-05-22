import { notFound } from "../errors/index.js";
import {
  createPlanInBarbershop,
  findPlanByIdInBarbershop,
  deletePlanFromBarbershop,
  listPlansInBarbershop,
  updatePlanInBarbershop,
} from "../repository/subscriptionPlanRepository.js";
import crypto from 'crypto';
import { pagarmeRequest } from './pagarmeApi.js';
import prisma from "../database/database.js";

/* ─────────────── helpers ─────────────── */

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

// function serialize(plan: any) {
//   return {
//     id: plan.id,
//     barbershopId: plan.barbershop_id,
//     name: plan.name,
//     subtitle: plan.subtitle,
//     price: decimalToNumber(plan.price),
//     color: plan.color,
//     cutsPerMonth: plan.cuts_per_month,
//     maxBarbers: plan.max_barbers,
//     maxReceptionists: plan.max_receptionists,
//     maxAdmins: plan.max_admins,
//     active: plan.active,
//     recommended: plan.recommended,
//     features: (plan.subscription_plan_features ?? []).map((f: any) => f.feature),
//     createdAt: plan.created_at,
//     updatedAt: plan.updated_at,
//   };
// }

function serialize(plan: any) {
  return {
    id: plan.id,
    barbershopId: plan.barbershop_id,
    name: plan.name,
    subtitle: plan.subtitle,
    price: decimalToNumber(plan.price),
    color: plan.color,
    cutsPerMonth: plan.cuts_per_month,
    maxBarbers: plan.max_barbers,
    maxReceptionists: plan.max_receptionists,
    maxAdmins: plan.max_admins,
    active: plan.active,
    recommended: plan.recommended,

    pagarmePlanId: plan.pagarme_plan_id,
    // pagarmePlanCode: plan.pagarme_plan_code,
    // pagarmePlanStatus: plan.pagarme_plan_status,

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
// export async function createPlanService(params: {
//   barbershopId: string;
//   data: {
//     name: string;
//     subtitle?: string | null;
//     price: number;
//     color?: string | null;
//     cutsPerMonth: number;
//     active?: boolean;
//     recommended?: boolean;
//     features?: string[];
//     maxBarbers?: number | null;
//     maxReceptionists?: number | null;
//     maxAdmins?: number | null;
//   };
// }) {
//   const { ...dataToPersist } = params.data;

//   const created = await createPlanInBarbershop({
//     barbershopId: params.barbershopId,
//     ...dataToPersist,
//     maxBarbers: dataToPersist.maxBarbers,
//     maxReceptionists: dataToPersist.maxReceptionists,
//     maxAdmins: dataToPersist.maxAdmins
//   });
//   return serialize(created);
// }

function toCents(value: number | string | null | undefined) {
  return Math.round(Number(value || 0) * 100);
}
async function createPagarmePlanForSubscriptionPlan(params: {
  localPlanId: string;
  barbershopId: string;
  barbershopName?: string | null;
  name: string;
  subtitle?: string | null;
  price: number;
}) {
  const amountInCents = toCents(params.price);

  if (!amountInCents || amountInCents <= 0) {
    throw new Error('Valor do plano inválido para criar no Pagar.me.');
  }

  const payload = {
    name: `${params.barbershopName || 'Barbearia'} - ${params.name}`.slice(0, 64),
    description: params.subtitle || `Plano ${params.name}`,
    currency: 'BRL',
    interval: 'month',
    interval_count: 1,
    billing_type: 'prepaid',
    payment_methods: ['credit_card'],
    installments: [1],
    items: [
      {
        name: params.name,
        quantity: 1,
        pricing_scheme: {
          price: amountInCents,
        },
      },
    ],
    metadata: {
      type: 'barbershop_client_plan',
      localPlanId: String(params.localPlanId),
      barbershopId: String(params.barbershopId),
    },
  };

  return pagarmeRequest('/plans', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });
}

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
    features?: string[];
    maxBarbers?: number | null;
    maxReceptionists?: number | null;
    maxAdmins?: number | null;
    syncPagarme?: boolean;
  };
}) {
  const { syncPagarme = true, ...dataToPersist } = params.data;

  const created = await createPlanInBarbershop({
    barbershopId: params.barbershopId,
    ...dataToPersist,
    maxBarbers: dataToPersist.maxBarbers,
    maxReceptionists: dataToPersist.maxReceptionists,
    maxAdmins: dataToPersist.maxAdmins,
  });

  if (!created) {
    throw new Error('Falha ao criar plano localmente');
  }

  if (!syncPagarme) {
    return serialize(created);
  }

  const barbershop = await prisma.barbershops.findUnique({
    where: { id: String(params.barbershopId) },
    select: {
      id: true,
      name: true,
    },
  });

  try {
    const pagarmePlan = await createPagarmePlanForSubscriptionPlan({
      localPlanId: created.id,
      barbershopId: params.barbershopId,
      barbershopName: barbershop?.name || null,
      name: created.name,
      subtitle: created.subtitle,
      price: decimalToNumber(created.price),
    });

    const updated = await prisma.subscription_plans.update({
      where: { id: created.id },
      data: {
        pagarme_plan_id: pagarmePlan.id,
        pagarme_plan_code: pagarmePlan.code || null,
        pagarme_plan_status: pagarmePlan.status || 'active',
      },
      include: {
        subscription_plan_features: {
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    return serialize(updated);
  } catch (error) {
    await prisma.subscription_plans.update({
      where: { id: created.id },
      data: {
        active: false,
        pagarme_plan_status: 'pagarme_create_failed',
      },
    });

    console.error('Erro ao criar plano no Pagar.me:', error);

    throw new Error(
      'Plano local criado, mas falhou ao criar o plano no Pagar.me. O plano foi desativado.'
    );
  }
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
    features?: string[];
    maxBarbers?: number | null;
    maxReceptionists?: number | null;
    maxAdmins?: number | null;
  };
}) {
  const { ...dataToPersist } = params.data;

  const existing = await findPlanByIdInBarbershop(params.barbershopId, params.planId);
  if (!existing) throw notFound("Plano não encontrado");

  const updated = await updatePlanInBarbershop(
    params.barbershopId,
    params.planId,
    {
      ...dataToPersist,
      maxBarbers: dataToPersist.maxBarbers,
      maxReceptionists: dataToPersist.maxReceptionists,
      maxAdmins: dataToPersist.maxAdmins
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
