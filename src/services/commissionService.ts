type CommissionType = "subscription" | "single" | "chemistry";

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function resolveServiceCommissionType(service: {
  coveredByPlan?: boolean | null;
  commissionPercent?: number | null;
  serviceName?: string | null;
}): CommissionType {
  if (service.coveredByPlan) {
    return "subscription";
  }

  if (Number(service.commissionPercent) === 40) {
    return "chemistry";
  }

  const normalizedServiceName = normalizeText(service.serviceName);

  if (normalizedServiceName.includes("quimic") || normalizedServiceName.includes("quimica")) {
    return "chemistry";
  }

  return "single";
}

export function calculateCommission(params: {
  amount: number;
  type: CommissionType;
}) {
  const amount = Number(params.amount) || 0;

  switch (params.type) {
    case "subscription":
      return roundMoney((amount * 0.5) / 4);
    case "chemistry":
      return roundMoney(amount * 0.4);
    case "single":
    default:
      return roundMoney(amount * 0.5);
  }
}

export function getCommissionPercentByType(type: CommissionType) {
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

export type { CommissionType };
