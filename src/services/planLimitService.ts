import { conflict } from "../errors/index.js";
import prisma from "../database/database.js";
import { findActiveSubscriptionByBarbershop } from "../repository/subscriptionRepository.js";

type RoleKey = "barber" | "receptionist" | "admin";

export async function getCurrentRoleCounts(barbershopId: string) {
  const [barbersCount, receptionistsCount, adminsCount] = await Promise.all([
    prisma.barbers.count({ where: { barbershop_id: barbershopId } }),
    prisma.users.count({ where: { current_barbershop_id: barbershopId, role: "receptionist" } }),
    prisma.users.count({ where: { current_barbershop_id: barbershopId, OR: [{ role: "admin" }, { is_admin: true }] } }),
  ]);

  return {
    barbers: barbersCount,
    receptionists: receptionistsCount,
    admins: adminsCount,
  };
}

export async function ensureCanAddRole(barbershopId: string, role: RoleKey, quantity = 1) {
  const subscription = await findActiveSubscriptionByBarbershop(barbershopId);
  // if no subscription or plan has null limits => unlimited
  const plan = subscription?.subscription_plans;
  if (!plan) return;

  const counts = await getCurrentRoleCounts(barbershopId);

  if (role === "barber" && plan.max_barbers != null) {
    if (counts.barbers + quantity > plan.max_barbers) {
      throw conflict(`Seu plano atual permite no máximo ${plan.max_barbers} barbeiro(s). Faça upgrade para adicionar outro.`);
    }
  }

  if (role === "receptionist" && plan.max_receptionists != null) {
    if (counts.receptionists + quantity > plan.max_receptionists) {
      throw conflict(`Seu plano atual permite no máximo ${plan.max_receptionists} recepcionista(s). Faça upgrade para adicionar outro.`);
    }
  }

  if (role === "admin" && plan.max_admins != null) {
    if (counts.admins + quantity > plan.max_admins) {
      throw conflict(`Seu plano atual permite no máximo ${plan.max_admins} administrador(es). Faça upgrade para adicionar outro.`);
    }
  }
}

export default { ensureCanAddRole, getCurrentRoleCounts };
