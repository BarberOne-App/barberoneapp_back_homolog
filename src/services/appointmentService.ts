import { badRequest, forbidden, notFound } from "../errors/index.js";
import {
  cancelAppointmentInBarbershop,
  createAppointmentTx,
  findAppointmentByIdInBarbershop,
  getBarberAppointmentsForDate,
  getClientAppointmentsForDate,
  listAppointmentsInBarbershop,
  updateAppointmentInBarbershop,
} from "../repository/appointmentRepository.js";
import { findBarberByIdInBarbershop, findBarberByUserIdInBarbershop } from "../repository/barberRepository.js";
import { getHomeInfoByBarbershop } from "../repository/settingRepository.js";
import { findActiveSubscriptionByUser } from "../repository/subscriptionRepository.js";
import { sendAppointmentConfirmedEmail } from "./emailService.js";

/* ─────────────────── helpers ─────────────────── */

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

function getServiceDurationMinutes(service: any): number {
  const raw = service?.duration ?? service?.durationMinutes ?? service?.duration_minutes;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const APPOINTMENT_CONFIRMATION_TEST_EMAIL = "rodolphopbuettel@outlook.com";

function getSaoPauloTimeParts(date: Date | string) {
  const value = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const [hourStr, minuteStr] = formatter.format(value).split(":");
  return {
    hour: Number(hourStr),
    minute: Number(minuteStr),
  };
}

function buildSaoPauloDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`);
}

function serializeAppointment(a: any) {
  return {
    id: a.id,
    barberId: a.barber_id,
    clientId: a.client_id,
    dependentId: a.dependent_id ?? null,
    startAt: a.start_at,
    endAt: a.end_at,
    status: a.status,
    notes: a.notes,
    barbershopId: a.barbershop_id,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    barber: a.barbers
      ? { id: a.barbers.id, displayName: a.barbers.display_name, photoUrl: a.barbers.photo_url }
      : null,
    client: a.users
      ? { id: a.users.id, name: a.users.name, email: a.users.email, phone: a.users.phone }
      : null,
    dependent: a.dependents
      ? { id: a.dependents.id, name: a.dependents.name, age: a.dependents.age }
      : null,
    services: (a.appointment_services ?? []).map((s: any) => ({
      id: s.id,
      serviceId: s.service_id,
      serviceName: s.service_name,
      unitPrice: decimalToNumber(s.unit_price),
      durationMinutes: s.duration_minutes,
      quantity: s.quantity,
    })),
    products: (a.appointment_products ?? []).map((p: any) => ({
      id: p.id,
      productId: p.product_id,
      productName: p.product_name,
      unitPrice: decimalToNumber(p.unit_price),
      discountPercent: p.discount_percent,
      quantity: p.quantity,
    })),
  };
}

/* ── Horário de funcionamento padrão (configurável futuramente) ── */
const OPEN_HOUR = 9; // 09:00
const CLOSE_HOUR = 20; // 20:00
const SLOT_STEP = 30; // intervalo base de 30 min

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseTimeToMinutes(raw: string) {
  const value = normalizeText(raw).replace(/\s+/g, "");
  const match = value.match(/^(\d{1,2})(?::?(\d{2}))?h?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

function getSaoPauloNow() {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const todayStr = dateFormatter.format(now);
  const [hourStr, minuteStr] = timeFormatter.format(now).split(":");
  const nowMinutes = Number(hourStr) * 60 + Number(minuteStr);

  return { todayStr, nowMinutes };
}

function extractTimeRangeFromLine(line: string) {
  const normalized = normalizeText(line);
  const timeRegex = /(\d{1,2}(?::\d{2})?\s*h?)/g;
  const times = [...normalized.matchAll(timeRegex)].map((m) => m[1]).filter(Boolean);
  if (times.length < 2) return null;

  const start = parseTimeToMinutes(times[0]);
  const end = parseTimeToMinutes(times[1]);
  if (start == null || end == null || end <= start) return null;

  return { start, end };
}

function dayTokenToWeekday(token: string): number | null {
  const t = normalizeText(token);
  if (t.startsWith("dom")) return 0;
  if (t.startsWith("seg")) return 1;
  if (t.startsWith("ter")) return 2;
  if (t.startsWith("qua")) return 3;
  if (t.startsWith("qui")) return 4;
  if (t.startsWith("sex")) return 5;
  if (t.startsWith("sab")) return 6;
  return null;
}

function lineAppliesToWeekday(line: string, weekday: number) {
  const normalized = normalizeText(line);
  const dayRegex = /(domingo|dom|segunda|seg|terca|ter|quarta|qua|quinta|qui|sexta|sex|sabado|sab)/g;
  const tokens = [...normalized.matchAll(dayRegex)].map((m) => m[1]);
  const days: number[] = [];
  for (const token of tokens) {
    const day = dayTokenToWeekday(token);
    if (day !== null) days.push(day);
  }

  if (days.length === 0) return true;

  if (days.length >= 2 && /(\sa\s|ate)/.test(normalized)) {
    const start = days[0]!;
    const end = days[1]!;
    if (start <= end) return weekday >= start && weekday <= end;
    return weekday >= start || weekday <= end;
  }

  return days.includes(weekday);
}

async function getOpeningWindowFromHomeInfo(barbershopId: string, date: string) {
  const row = await getHomeInfoByBarbershop(barbershopId);
  const target = new Date(`${date}T12:00:00`);
  const weekday = target.getUTCDay();

  const lines = [row?.schedule_line1, row?.schedule_line2, row?.schedule_line3].filter(Boolean) as string[];

  for (const line of lines) {
    if (!lineAppliesToWeekday(line, weekday)) continue;

    const normalized = normalizeText(line);
    if (normalized.includes("fechado") || normalized.includes("closed")) {
      return null;
    }

    const range = extractTimeRangeFromLine(line);
    if (range) {
      return range;
    }
  }

  return { start: OPEN_HOUR * 60, end: CLOSE_HOUR * 60 };
}

/* ─────────────────────────── LIST ─────────────────────────── */
export async function listAppointmentsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  query: {
    barberId?: string;
    clientId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    allAppointments?: boolean | string;  // ✅ Pode ser boolean ou string
  };
}) {
  // 🔴 Se allAppointments=true, retornar TODOS os agendamentos sem filtro de cliente
  // (usado pelo frontend para validar horários disponíveis)
  const shouldReturnAll = String(params.query.allAppointments).toLowerCase() === 'true';
  if (shouldReturnAll) {
    const page = params.query.page ?? 1;
    const limit = params.query.limit ?? 100;

    const { items, total } = await listAppointmentsInBarbershop({
      barbershopId: params.barbershopId,
      barberId: params.query.barberId,
      clientId: undefined,  // ✅ Sem filtro de cliente
      status: params.query.status,
      dateFrom: params.query.dateFrom,
      dateTo: params.query.dateTo,
      page,
      limit,
    });

    return {
      page,
      limit,
      total,
      items: items.map(serializeAppointment),
    };
  }

  // Clientes só veem seus próprios agendamentos (comportamento padrão)
  let clientId = params.query.clientId;
  if (params.actorRole === "client") {
    clientId = params.actorId;
  }

  // Barbeiro sem permissão admin vê apenas seus agendamentos
  let barberId = params.query.barberId;
  if (params.actorRole === "barber") {
  }

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 100;

  const { items, total } = await listAppointmentsInBarbershop({
    barbershopId: params.barbershopId,
    barberId,
    clientId,
    status: params.query.status,
    dateFrom: params.query.dateFrom,
    dateTo: params.query.dateTo,
    page,
    limit,
  });

  return {
    page,
    limit,
    total,
    items: items.map(serializeAppointment),
  };
}

/* ────────────────────────── GET BY ID ────────────────────────── */
export async function getAppointmentByIdService(params: {
  barbershopId: string;
  appointmentId: string;
}) {
  const appt = await findAppointmentByIdInBarbershop(params.barbershopId, params.appointmentId);
  if (!appt) throw notFound("Agendamento não encontrado");
  return serializeAppointment(appt);
}

/* ────────────────────────── CREATE ────────────────────────── */
export async function createAppointmentService(params: {
  barbershopId: string;
  data: {
    barberId: string;
    clientId: string;
    dependentId?: string | null;
    date: string; // "YYYY-MM-DD"
    time: string; // "HH:MM"
    notes?: string | null;
    services: {
      id: string;
      name: string;
      basePrice: number;
      duration?: number;
      durationMinutes?: number;
      duration_minutes?: number;
      quantity?: number;
    }[];
    products: { id: string; name: string; price: number; quantity?: number; discount?: number }[];
  };
}) {
  const { barberId, clientId, dependentId, date, time, services, products } = params.data;

  // 1. Validar que o barbeiro existe na barbearia
  const barber = await findBarberByIdInBarbershop(params.barbershopId, barberId);
  if (!barber) throw notFound("Barbeiro não encontrado");

  // 2. Calcular duração total dos serviços
  const totalDuration = services.reduce(
    (sum, s) => sum + getServiceDurationMinutes(s) * (s.quantity ?? 1),
    0
  );
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw badRequest("Duração total dos serviços deve ser > 0");
  }

  // 3. Montar datas de início e fim considerando o horário de São Paulo
  const startAt = buildSaoPauloDateTime(date, time);
  if (Number.isNaN(startAt.getTime())) {
    throw badRequest("Data ou horário inválidos");
  }
  const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

  // 4. Validar horário de funcionamento
  const startHour = startAt.getUTCHours();
  const endHour = endAt.getUTCHours() + (endAt.getUTCMinutes() > 0 ? 1 : 0);
  // if (startHour < OPEN_HOUR || endHour > CLOSE_HOUR) {
  //   throw badRequest(`Horário fora do funcionamento (${OPEN_HOUR}:00 – ${CLOSE_HOUR}:00)`);
  // }

  // 5. Validar que não é data/horário no passado (horário local da barbearia)
  const startMinutes = parseTimeToMinutes(time);
  const { todayStr, nowMinutes } = getSaoPauloNow();
  const isPastDate = date < todayStr;
  const isPastTimeToday = date === todayStr && startMinutes != null && startMinutes <= nowMinutes;

  if (isPastDate || isPastTimeToday) {
    throw badRequest("Não é possível agendar no passado");
  }

  // 5.1 Enforçar vínculo mensal de assinante ao barbeiro (regra de negócio)
  const activeSubscription = await findActiveSubscriptionByUser(params.barbershopId, clientId);
  if (activeSubscription?.monthly_barber_id && activeSubscription?.monthly_barber_set_at) {
    const lockDate = new Date(activeSubscription.monthly_barber_set_at);
    const isSameMonthAsAppointment =
      lockDate.getUTCFullYear() === startAt.getUTCFullYear() &&
      lockDate.getUTCMonth() === startAt.getUTCMonth();

    if (isSameMonthAsAppointment && activeSubscription.monthly_barber_id !== barberId) {
      throw badRequest("Assinatura vinculada a outro barbeiro neste mês");
    }
  }

  // 6. Verificar conflitos de horário com o barbeiro
  const existing = await getBarberAppointmentsForDate(params.barbershopId, barberId, date);
  const hasConflict = existing.some((appt) => {
    const existStart = new Date(appt.start_at).getTime();
    const existEnd = new Date(appt.end_at).getTime();
    const newStart = startAt.getTime();
    const newEnd = endAt.getTime();
    // conflito se os intervalos se sobrepõem
    return newStart < existEnd && newEnd > existStart;
  });

  if (hasConflict) {
    throw badRequest("Conflito de horário — barbeiro já possui agendamento neste período");
  }

  // 6.1 Verificar conflitos de horário para o mesmo cliente/dependente (mesmo período)
  const existingForClient = await getClientAppointmentsForDate({
    barbershopId: params.barbershopId,
    clientId,
    dependentId: dependentId ?? null,
    date,
  });

  const hasClientConflict = existingForClient.some((appt) => {
    const existStart = new Date(appt.start_at).getTime();
    const existEnd = new Date(appt.end_at).getTime();
    const newStart = startAt.getTime();
    const newEnd = endAt.getTime();
    return newStart < existEnd && newEnd > existStart;
  });

  if (hasClientConflict) {
    throw badRequest("Conflito de horário — cliente/dependente já possui agendamento neste período");
  }


  // 7. Criar agendamento em transação (appointment + services + products + estoque)
  const created = await createAppointmentTx({
    barbershopId: params.barbershopId,
    barberId,
    clientId,
    dependentId: dependentId ?? null,
    startAt,
    endAt,
    notes: params.data.notes,
    services: services.map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      unitPrice: s.basePrice,
      durationMinutes: getServiceDurationMinutes(s),
      quantity: s.quantity ?? 1,
    })),
    products: (products ?? []).map((p) => ({
      productId: p.id,
      productName: p.name,
      unitPrice: p.price,
      discountPercent: p.discount ?? 0,
      quantity: p.quantity ?? 1,
    })),
  });

  return serializeAppointment(created);
}

/* ────────────────────────── UPDATE ────────────────────────── */
export async function updateAppointmentService(params: {
  barbershopId: string;
  actorRole: string;
  actorIsAdmin?: boolean;
  actorId: string;
  appointmentId: string;
  data: {
    status?: string;
    notes?: string;
    barberId?: string;
  };
}) {
  const isAdmin = params.actorRole === "admin" || !!params.actorIsAdmin;
  const isReceptionist = params.actorRole === "receptionist";
  const actorBarber = await findBarberByUserIdInBarbershop(params.barbershopId, params.actorId);

  const existingAppointment = await findAppointmentByIdInBarbershop(params.barbershopId, params.appointmentId);
  if (!existingAppointment) throw notFound("Agendamento não encontrado");

  const isOwnBarberAppointment =
    !!actorBarber && String(existingAppointment.barber_id) === String(actorBarber.id);

  if (!isAdmin && !isReceptionist && !isOwnBarberAppointment) {
    throw forbidden("Apenas admin, recepcionista ou o barbeiro do agendamento pode atualizar");
  }

  const updateData: any = {};

  if (params.data.status !== undefined) updateData.status = params.data.status;
  if (params.data.notes !== undefined) updateData.notes = params.data.notes;
  if (params.data.barberId !== undefined) {
    // Validar barbeiro
    const barber = await findBarberByIdInBarbershop(params.barbershopId, params.data.barberId);
    if (!barber) throw notFound("Barbeiro não encontrado");
    updateData.barber_id = params.data.barberId;
  }

  const updated = await updateAppointmentInBarbershop(params.barbershopId, params.appointmentId, updateData);
  if (!updated) throw notFound("Agendamento não encontrado");

  const statusWillBeConfirmed = String(params.data.status || "").toLowerCase() === "confirmed";
  const wasAlreadyConfirmed = String(existingAppointment.status || "").toLowerCase() === "confirmed";
  const recipientEmail = APPOINTMENT_CONFIRMATION_TEST_EMAIL;

  if (statusWillBeConfirmed && !wasAlreadyConfirmed && recipientEmail) {
    const serviceNames = (updated.appointment_services ?? [])
      .map((service: any) => String(service.service_name || "").trim())
      .filter(Boolean);

    sendAppointmentConfirmedEmail({
      to: recipientEmail,
      clientName: updated.users?.name,
      dependentName: updated.dependents?.name,
      barberName: updated.barbers?.display_name,
      startAt: updated.start_at,
      serviceNames,
    }).catch((error) => {
      console.error("[email] Falha ao enviar e-mail de confirmação de agendamento:", error);
    });
  }

  return serializeAppointment(updated);
}

/* ────────────────────────── CANCEL (DELETE soft) ────────────────────────── */
export async function cancelAppointmentService(params: {
  barbershopId: string;
  appointmentId: string;
}) {
  const cancelled = await cancelAppointmentInBarbershop(params.barbershopId, params.appointmentId);
  if (!cancelled) throw notFound("Agendamento não encontrado");
  return serializeAppointment(cancelled);
}

/* ═══════════════════════════════════════════════════════════
   AVAILABLE SLOTS — Lógica Crítica
   ═══════════════════════════════════════════════════════════ */
export async function getAvailableSlotsService(params: {
  barbershopId: string;
  barberId: string;
  date: string; // "YYYY-MM-DD"
  duration: number; // minutos do serviço
}) {
  // 1. Validar barbeiro
  const barber = await findBarberByIdInBarbershop(params.barbershopId, params.barberId);
  if (!barber) throw notFound("Barbeiro não encontrado");

  // 2. Buscar agendamentos existentes do barbeiro no dia
  const appointments = await getBarberAppointmentsForDate(
    params.barbershopId,
    params.barberId,
    params.date
  );

  // 3. Converter para intervalos ocupados [{start, end}] em minutos desde meia-noite UTC
  const busy = appointments.map((a) => {
    const s = getSaoPauloTimeParts(a.start_at);
    const e = getSaoPauloTimeParts(a.end_at);
    return {
      start: s.hour * 60 + s.minute,
      end: e.hour * 60 + e.minute,
    };
  });

  // 4. Gerar slots com base no horário de funcionamento configurado no home-info
  const openingWindow = await getOpeningWindowFromHomeInfo(params.barbershopId, params.date);
  if (!openingWindow) return [];

  const openMin = openingWindow.start;
  const closeMin = openingWindow.end;
  const slots: string[] = [];

  for (let slotStart = openMin; slotStart + params.duration <= closeMin; slotStart += SLOT_STEP) {
    const slotEnd = slotStart + params.duration;

    // 5. Verificar se o slot colide com algum agendamento existente
    const collision = busy.some((b) => slotStart < b.end && slotEnd > b.start);

    if (!collision) {
      const hh = String(Math.floor(slotStart / 60)).padStart(2, "0");
      const mm = String(slotStart % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }

  // 6. Se a data é hoje, remover horários que já passaram (São Paulo)
  const { todayStr, nowMinutes } = getSaoPauloNow();
  if (params.date === todayStr) {
    return slots.filter((s) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    });
  }

  return slots;
}
