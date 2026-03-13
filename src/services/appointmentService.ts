import { badRequest, forbidden, notFound } from "../errors/index.js";
import {
  cancelAppointmentInBarbershop,
  createAppointmentTx,
  findAppointmentByIdInBarbershop,
  getBarberAppointmentsForDate,
  listAppointmentsInBarbershop,
  updateAppointmentInBarbershop,
} from "../repository/appointmentRepository.js";
import { findBarberByIdInBarbershop } from "../repository/barberRepository.js";

/* ─────────────────── helpers ─────────────────── */

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

function serializeAppointment(a: any) {
  console.log('SERIALIZANDO APPOINTMENT', a);
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
  };
}) {
  // Clientes só veem seus próprios agendamentos
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
    services: { id: string; name: string; basePrice: number; duration: number; quantity?: number }[];
    products: { id: string; name: string; price: number; quantity?: number; discount?: number }[];
  };
}) {
  const { barberId, clientId, dependentId, date, time, services, products } = params.data;

  // 1. Validar que o barbeiro existe na barbearia
  const barber = await findBarberByIdInBarbershop(params.barbershopId, barberId);
  if (!barber) throw notFound("Barbeiro não encontrado");

  // 2. Calcular duração total dos serviços
  const totalDuration = services.reduce((sum, s) => sum + s.duration * (s.quantity ?? 1), 0);
  if (totalDuration <= 0) throw badRequest("Duração total dos serviços deve ser > 0");

  // 3. Montar datas de início e fim
  const startAt = new Date(`${date}T${time}:00Z`);
  const endAt = new Date(startAt.getTime() + 50 * 60_000);

  // 4. Validar horário de funcionamento
  const startHour = startAt.getUTCHours();
  const endHour = endAt.getUTCHours() + (endAt.getUTCMinutes() > 0 ? 1 : 0);
  if (startHour < OPEN_HOUR || endHour > CLOSE_HOUR) {
    throw badRequest(`Horário fora do funcionamento (${OPEN_HOUR}:00 – ${CLOSE_HOUR}:00)`);
  }

  // 5. Validar que não é data no passado
  if (startAt < new Date()) {
    throw badRequest("Não é possível agendar no passado");
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

  console.log("DEPENDENTE " + dependentId);

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
      durationMinutes: 50,
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
  appointmentId: string;
  data: {
    status?: string;
    notes?: string;
    barberId?: string;
  };
}) {
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
    const s = new Date(a.start_at);
    const e = new Date(a.end_at);
    return {
      start: s.getUTCHours() * 60 + s.getUTCMinutes(),
      end: e.getUTCHours() * 60 + e.getUTCMinutes(),
    };
  });

  // 4. Gerar todos os slots possíveis (a cada SLOT_STEP min) dentro do horário de funcionamento
  const openMin = OPEN_HOUR * 60; // ex: 540
  const closeMin = CLOSE_HOUR * 60; // ex: 1200
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

  // 6. Se a data é hoje, remover horários que já passaram
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (params.date === todayStr) {
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    return slots.filter((s) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m > nowMin;
    });
  }

  return slots;
}
