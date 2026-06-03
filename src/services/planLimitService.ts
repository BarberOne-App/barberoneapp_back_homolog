import prisma from "../database/database.js";
import { forbidden } from "../errors/index.js";

export interface PlanLimitValidation {
  allowed: boolean;
  planName: string | null;
  message?: string;
}

export async function getActivePlatformSubscription(barbershopId: string) {
  return prisma.barbershop_platform_subscriptions.findFirst({
    where: {
      barbershop_id: barbershopId,
      status: {
        in: ['active', 'future'],
      },
      canceled_at: null,
    },
    include: {
      platform_plan: {
        select: {
          id: true,
          name: true,
          max_barbers: true,
          max_admins: true,
          max_receptionists: true,
        },
      },
    } as any,
    orderBy: { created_at: 'desc' },
  });
}

export async function countUsersByRoleInBarbershop(
  barbershopId: string,
  role: string
): Promise<number> {
  if (role === "barber") {
    return prisma.barbers.count({
      where: { barbershop_id: barbershopId },
    });
  }

  return prisma.users.count({
    where: {
      current_barbershop_id: barbershopId,
      role: role as any,
    },
  });
}

function getRoleLimit(plan: any, role: string): number | null {
  if (!plan) return null;
  if (role === 'barber') return plan.max_barbers ?? null;
  if (role === 'admin') return plan.max_admins ?? null;
  if (role === 'receptionist') return plan.max_receptionists ?? null;
  return null;
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    barber: "barbeiro",
    admin: "administrador",
    receptionist: "recepcionista",
    client: "cliente",
  };
  return labels[role] || role;
}

export async function validatePlanUserLimit(
  barbershopId: string,
  role: string
): Promise<PlanLimitValidation> {
  const platformSubscription = await getActivePlatformSubscription(barbershopId);

  if (!platformSubscription) {
    throw forbidden(
      "Esta barbearia não possui um plano de assinatura ativo. Faça upgrade para continuar."
    );
  }

  console.log("Assinatura ativa encontrada:", {
    id: platformSubscription.id,
    status: platformSubscription.status,
    selected_plan: platformSubscription.selected_plan,
    platform_plan: platformSubscription.platform_plan,
  });

  var platformPlan = platformSubscription.selected_plan as any;
  const planName = platformPlan?.name ?? platformSubscription.selected_plan ?? null;

  if (platformPlan == 'basic') {
    platformPlan = 'Plano Básico';
  }

  const roleLimit = getRoleLimit(platformPlan, role);

  console.log(`Limite para o papel ${role} no plano ${planName}:`, roleLimit);

  // null significa ilimitado
  if (roleLimit === null) {
    return { allowed: true, planName };
  }

  const currentCount = await countUsersByRoleInBarbershop(barbershopId, role);

  console.log("Contagem atual de usuários com o papel", role, "na barbearia:", currentCount);

  if (currentCount >= roleLimit) {
    const roleLabel = getRoleLabel(role);
    const message = `Seu plano permite no máximo ${roleLimit} ${roleLabel}${roleLimit !== 1 ? "s" : ""}. Faça upgrade para adicionar mais.`;
    throw forbidden(message);
  }

  return { allowed: true, planName };
}
