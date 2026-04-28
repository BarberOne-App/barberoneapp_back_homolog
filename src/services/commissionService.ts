function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export type ServiceCommissionType = "subscription" | "chemistry" | "single";

export function resolveServiceCommissionType(service: {
  coveredByPlan?: boolean | null;
  commissionPercent?: number | null;
  serviceName?: string | null;
}): ServiceCommissionType {
  if (service.coveredByPlan) {
    return "subscription";
  }

  if (Number(service.commissionPercent) === 40) {
    return "chemistry";
  }

  const normalizedServiceName = normalizeText(service.serviceName ?? "");
  if (normalizedServiceName.includes("quimic") || normalizedServiceName.includes("quimica")) {
    return "chemistry";
  }

  return "single";
}

export function getCommissionPercentByType(type: ServiceCommissionType) {
  switch (type) {
    case "subscription":
      return 12.5;
    case "chemistry":
      return 40;
    case "single":
    default:
      return 50;
  }
}

export function calculateCommission(params: {
  amount: number;
  type: ServiceCommissionType;
  commissionPercent?: number | null;
}) {
  const amount = Number(params.amount) || 0;
  const commissionPercent = Number(params.commissionPercent);
  const effectivePercent = Number.isFinite(commissionPercent)
    ? commissionPercent
    : getCommissionPercentByType(params.type);

  switch (params.type) {
    case "subscription":
      return roundMoney(((amount * effectivePercent) / 100) / 4);
    case "chemistry":
    case "single":
    default:
      return roundMoney((amount * effectivePercent) / 100);
  }
}
