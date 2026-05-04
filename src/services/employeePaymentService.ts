import { badRequest, forbidden } from "../errors/index.js";
import {
  createEmployeePayment,
  findEmployeePaymentByPeriod,
  listEmployeePayments,
  findLastEmployeePayment, 
} from "../repository/employeePaymentRepository.js";

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function serialize(payment: any) {
  return {
    id: payment.id,
    employeeId: payment.employee_id,
    employeeName: payment.employee_name,
    period: payment.period,
    periodStart: payment.period_start,
    periodEnd: payment.period_end,
    salarioFixo: Number(payment.base_salary),
    commission: Number(payment.commission),
    totalVales: Number(payment.total_vales),
    liquido: Number(payment.net_amount),
    paidAt: payment.paid_at,
    paidBy: payment.paid_by,
    paidByName: payment.creator?.name ?? null,
    createdAt: payment.created_at,
  };
}

export async function syncEmployeeCommissionFromAppointmentPayment(params: {
  barbershopId: string;
  appointmentId: string;
  paidAt?: Date | null;
  actorId?: string | null;
}) {
  return null;
}

export async function listEmployeePaymentsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
}) {
  if (
    params.actorRole !== "admin" &&
    params.actorRole !== "barber" &&
    params.actorRole !== "receptionist"
  ) {
    throw forbidden("Sem permissão para listar pagamentos de funcionários");
  }

  const employeeId = params.actorRole === "barber" ? params.actorId : undefined;

  const items = await listEmployeePayments(params.barbershopId, employeeId);

  return items.map(serialize);
}

export async function createEmployeePaymentService(params: {
  barbershopId: string;
  actorId: string;
  data: {
    employeeId: string;
    employeeName: string;
    period: string; 
    periodStart: string;
    periodEnd: string;
    salarioFixo: number;
    commission: number;
    totalVales: number;
    liquido: number;
  };
}) {
  const existingPayment = await findEmployeePaymentByPeriod({
    barbershopId: params.barbershopId,
    employeeId: params.data.employeeId,
    period: params.data.period,
    periodStart: params.data.periodStart,
    periodEnd: params.data.periodEnd,
  });

  if (existingPayment) {
    throw badRequest(
      "Este funcionário já possui pagamento registrado para este período."
    );
  }

  const lastPayment = await findLastEmployeePayment({
    barbershopId: params.barbershopId,
    employeeId: params.data.employeeId,
  });

  if (lastPayment) {
    const lastPeriodEnd = new Date(lastPayment.period_end);

    let nextAllowedDate: Date;

    switch (params.data.period) {
      case "semanal":
        nextAllowedDate = addDays(lastPeriodEnd, 7);
        break;
      case "quinzenal":
        nextAllowedDate = addDays(lastPeriodEnd, 15);
        break;
      case "mensal":
        nextAllowedDate = addMonths(lastPeriodEnd, 1);
        break;
      default:
        nextAllowedDate = addDays(lastPeriodEnd, 7);
    }

    const hoje = new Date();

    if (hoje < nextAllowedDate) {
      throw badRequest(
        "Ainda não é possível realizar um novo pagamento. Aguarde o próximo período."
      );
    }
  }

  const created = await createEmployeePayment({
    employeeId: params.data.employeeId,
    employeeName: params.data.employeeName,
    period: params.data.period,
    periodStart: params.data.periodStart,
    periodEnd: params.data.periodEnd,
    baseSalary: params.data.salarioFixo,
    commission: params.data.commission,
    totalVales: params.data.totalVales,
    netAmount: params.data.liquido,
    paidBy: params.actorId,
    barbershopId: params.barbershopId,
  });

  return serialize(created);
}