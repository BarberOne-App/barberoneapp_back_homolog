import nodemailer from "nodemailer";

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildTransporter() {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error("SMTP não configurado. Defina EMAIL_HOST, EMAIL_USER e EMAIL_PASSWORD no backend.");
  }

  return nodemailer.createTransport({
    host,
    port: toNumber(process.env.EMAIL_PORT, 587),
    secure: String(process.env.EMAIL_SECURE || "false").toLowerCase() === "true",
    auth: {
      user,
      pass,
    },
  });
}

function formatDateTime(date: Date | string) {
  const value = date instanceof Date ? date : new Date(date);

  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    date: dateFormatter.format(value),
    time: timeFormatter.format(value),
  };
}

export async function sendAppointmentConfirmedEmail(params: {
  to: string;
  clientName?: string | null;
  dependentName?: string | null;
  barberName?: string | null;
  startAt: Date | string;
  serviceNames: string[];
}) {
  const transporter = buildTransporter();

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!from) return;

  const { date, time } = formatDateTime(params.startAt);
  const displayName = params.dependentName || params.clientName || "cliente";
  const services = params.serviceNames.length ? params.serviceNames.join(", ") : "Serviço";
  const barber = params.barberName || "seu barbeiro";

  const subject = "Seu agendamento foi confirmado";
  const text = [
    `Olá, ${displayName}!`,
    "",
    "Seu agendamento foi confirmado com sucesso.",
    `Data: ${date}`,
    `Horário: ${time}`,
    `Barbeiro: ${barber}`,
    `Serviços: ${services}`,
    "",
    "Se precisar remarcar, entre em contato com a barbearia.",
  ].join("\n");

  await transporter.sendMail({
    from,
    to: params.to,
    subject,
    text,
  });
}
