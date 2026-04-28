import { badRequest, forbidden } from "../errors/index.js";
import { getAppointmentByIdService } from "./appointmentService.js";
import { findBarberByIdInBarbershop } from "../repository/barberRepository.js";
import {
  createEmployeePayment,
  findEmployeePaymentByPeriod,
  incrementEmployeeCommissionByPeriod,
  listEmployeePayments,
} from "../repository/employeePaymentRepository.js";

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

function formatDateInSaoPaulo(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getMonthlyPeriodFromDate(date: Date) {
  const base = formatDateInSaoPaulo(date);
  const [yearStr, monthStr] = base.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodStart = `${yearStr}-${monthStr}-01`;
  const periodEnd = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  return {
    period: "mensal",
    periodStart,
    periodEnd,
  };
}

export async function syncEmployeeCommissionFromAppointmentPayment(params: {
  barbershopId: string;
  appointmentId: string;
  paidAt?: Date | null;
  actorId?: string | null;
}) {
  const appointment = await getAppointmentByIdService({
    barbershopId: params.barbershopId,
    appointmentId: params.appointmentId,
  });

  const commissionAmount = Number(appointment.commissionAmount ?? 0);
  if (!Number.isFinite(commissionAmount) || commissionAmount <= 0) {
    return null;
  }

  const barber = await findBarberByIdInBarbershop(params.barbershopId, appointment.barberId);
  if (!barber?.user_id) {
    return null;
  }
  const employeeId = barber.user_id;

  const paidAt = params.paidAt ?? new Date();
  const { period, periodStart, periodEnd } = getMonthlyPeriodFromDate(paidAt);
  const employeeName = barber.users?.name?.trim() || barber.display_name;
  const paidBy = params.actorId?.trim() || employeeId;

  const payment = await incrementEmployeeCommissionByPeriod({
    employeeId,
    employeeName,
    period,
    periodStart,
    periodEnd,
    commissionAmount,
    paidBy,
    paidAt,
    barbershopId: params.barbershopId,
  });

  return serialize(payment);
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
      "Este funcionário já possui pagamento registrado para este período. Não é permitido pagar salário e comissão novamente."
    );
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