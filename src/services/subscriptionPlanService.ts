import { notFound } from "../errors/index.js";
import {
  createPlanInBarbershop,
  findPlanByIdInBarbershop,
  deletePlanFromBarbershop,
  listPlansInBarbershop,
  updatePlanInBarbershop,
} from "../repository/subscriptionPlanRepository.js";

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
    maxBarbers: plan.max_barbers,
    maxReceptionists: plan.max_receptionists,
    maxAdmins: plan.max_admins,
    active: plan.active,
    recommended: plan.recommended,
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
    features?: string[];
    maxBarbers?: number | null;
    maxReceptionists?: number | null;
    maxAdmins?: number | null;
  };
}) {
  const {...dataToPersist } = params.data;

  const created = await createPlanInBarbershop({
    barbershopId: params.barbershopId,
    ...dataToPersist,
    maxBarbers: dataToPersist.maxBarbers,
    maxReceptionists: dataToPersist.maxReceptionists,
    maxAdmins: dataToPersist.maxAdmins
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
    features?: string[];
    maxBarbers?: number | null;
    maxReceptionists?: number | null;
    maxAdmins?: number | null;
  };
}) {
  const {...dataToPersist } = params.data;

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
