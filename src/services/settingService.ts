import { forbidden } from "../errors/index.js";
import {
    getSettingsByBarbershop,
    upsertSettingsByBarbershop,
    updateSlotIntervalByBarbershop,
    getHomeInfoByBarbershop,
    upsertHomeInfoByBarbershop,
} from "../repository/settingRepository.js";

type PayrollFrequency = "weekly" | "biweekly" | "monthly";

const SCHEDULE_PLACEHOLDERS = new Set([
    "Ex: Horário de Funcionamento",
    "Ex: Seg - 14h as 20h",
    "Ex: Terça a Sab. - 09h as 20h",
    "Ex: Domingo: Fechado",
]);

function normalizeHiddenBookingPaymentMethods(value: unknown) {
    if (!Array.isArray(value)) return [];

    const normalized = value
        .map((item) => String(item || "").trim().toLowerCase())
        .flatMap((item) => {
            if (item === "online") return ["cartao", "pix"];
            return item;
        })
        .filter((item) => item === "cartao" || item === "pix" || item === "local");

    return Array.from(new Set(normalized));
}

function normalizeHeroImages(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return Array.from(
        new Set(
            value
                .map((item) => String(item || "").trim())
                .filter((item) => item.length > 0),
        ),
    );
}

function normalizeScheduleField(value: unknown): string | null {
    const trimmed = String(value ?? "").trim();
    if (!trimmed || SCHEDULE_PLACEHOLDERS.has(trimmed)) return null;
    return trimmed;
}

function normalizePayrollFrequency(value: unknown): PayrollFrequency | null {
    const normalized = String(value || "").trim().toLowerCase();

    if (
        normalized === "weekly" ||
        normalized === "semanal"
    ) {
        return "weekly";
    }

    if (
        normalized === "biweekly" ||
        normalized === "quinzenal"
    ) {
        return "biweekly";
    }

    if (
        normalized === "monthly" ||
        normalized === "mensal"
    ) {
        return "monthly";
    }

    return null;
}

function getDefaultHomeInfo() {
    return {
        hero_title: "",
        hero_subtitle: "",
        hero_image: "",
        hero_images: [],
        about_title: "Barbearia Rodrigues",
        about_text1: "A Barbearia Rodrigues é referência em cortes masculinos há mais de 10 anos.",
        about_text2: "Combinamos técnicas tradicionais com tendências modernas para garantir o melhor atendimento.",
        about_text3: "Nosso ambiente proporciona conforto e uma experiência única.",
        schedule_title: "Horário de Funcionamento",
        schedule_line1: null,
        schedule_line2: null,
        schedule_line3: null,
        whatsapp_number: "",
        location_title: "Localização",
        location_address: "Av. val paraíso,1396",
        location_city: "Jangurussu - Fortaleza/CE",
        barber_payment_frequency: null,
        employee_payment_frequency: null,
    };
}

const VALID_SLOT_INTERVALS = [5, 10, 15, 30] as const;

// Formas de pagamento ocultas por padrão para novas barbearias
const DEFAULT_HIDDEN_PAYMENT_METHODS = ['cartao', 'pix', 'local'];

function normalizeSlotIntervalMinutes(value: unknown): number {
    const n = Number(value);
    if (VALID_SLOT_INTERVALS.includes(n as any)) return n;
    return 30;
}

export async function getSettingsService(barbershopId: string) {
    // getSettingsByBarbershop usa raw SQL — retorna slot_interval_minutes mesmo com Prisma client desatualizado
    const row = await getSettingsByBarbershop(barbershopId);

    // Barbearia sem nenhuma configuração salva ainda: todos os métodos de pagamento
    // ficam ocultos/desmarcados por padrão — o admin ativa manualmente os que desejar.
    const hiddenBookingPaymentMethods = row !== null
        ? normalizeHiddenBookingPaymentMethods(row.hidden_booking_payment_methods)
        : [...DEFAULT_HIDDEN_PAYMENT_METHODS];

    return {
        pixKey: row?.pix_key ?? "",
        termsDocumentUrl: row?.terms_document_url ?? "",
        termsDocumentName: row?.terms_document_name ?? "",
        hiddenBookingPaymentMethods,
        slotIntervalMinutes: normalizeSlotIntervalMinutes(row?.slot_interval_minutes ?? 30),
    };
}

export async function upsertSettingsService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client" | "receptionist";
    pixKey?: string;
    termsDocumentUrl?: string;
    termsDocumentName?: string;
    hiddenBookingPaymentMethods?: string[];
    slotIntervalMinutes?: number;
}) {
    if (params.actorRole !== "admin") {
        throw forbidden("Apenas admin pode alterar configurações");
    }

    // Lê estado atual para evitar update destrutivo: só sobrescreve campos presentes no request
    const current = await getSettingsByBarbershop(params.barbershopId);

    const pix_key = params.pixKey !== undefined
        ? (params.pixKey || null)
        : (current?.pix_key ?? null);

    const terms_document_url = params.termsDocumentUrl !== undefined
        ? (params.termsDocumentUrl || null)
        : (current?.terms_document_url ?? null);

    const terms_document_name = params.termsDocumentName !== undefined
        ? (params.termsDocumentName || null)
        : (current?.terms_document_name ?? null);

    const hidden_booking_payment_methods = params.hiddenBookingPaymentMethods !== undefined
        ? normalizeHiddenBookingPaymentMethods(params.hiddenBookingPaymentMethods)
        : current !== null
            ? normalizeHiddenBookingPaymentMethods(current.hidden_booking_payment_methods)
            : [...DEFAULT_HIDDEN_PAYMENT_METHODS]; // Primeira gravação: preserva o padrão oculto

    const row = await upsertSettingsByBarbershop(params.barbershopId, {
        pix_key,
        terms_document_url,
        terms_document_name,
        hidden_booking_payment_methods,
    });

    // slot_interval_minutes: campo novo, usa raw SQL para não depender do Prisma client
    let slotIntervalMinutes = normalizeSlotIntervalMinutes(current?.slot_interval_minutes ?? 30);
    if (params.slotIntervalMinutes !== undefined) {
        slotIntervalMinutes = normalizeSlotIntervalMinutes(params.slotIntervalMinutes);
        await updateSlotIntervalByBarbershop(params.barbershopId, slotIntervalMinutes);
    }

    return {
        pixKey: row.pix_key ?? "",
        termsDocumentUrl: row.terms_document_url ?? "",
        termsDocumentName: row.terms_document_name ?? "",
        hiddenBookingPaymentMethods: normalizeHiddenBookingPaymentMethods(row.hidden_booking_payment_methods),
        slotIntervalMinutes,
    };
}

export async function getHomeInfoService(barbershopId: string) {
    if (!String(barbershopId || "").trim()) {
        return getDefaultHomeInfo();
    }

    const row = await getHomeInfoByBarbershop(barbershopId);

    if (row) {
        const heroImages = normalizeHeroImages((row as any)?.hero_images);

        return {
            ...row,
            hero_images: heroImages,
            schedule_title: normalizeScheduleField((row as any)?.schedule_title),
            schedule_line1: normalizeScheduleField((row as any)?.schedule_line1),
            schedule_line2: normalizeScheduleField((row as any)?.schedule_line2),
            schedule_line3: normalizeScheduleField((row as any)?.schedule_line3),
            barber_payment_frequency:
                normalizePayrollFrequency((row as any)?.barber_payment_frequency) ?? null,
            employee_payment_frequency:
                normalizePayrollFrequency((row as any)?.employee_payment_frequency) ?? null,
        };
    }

    return getDefaultHomeInfo();
}

export async function upsertHomeInfoService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client" | "receptionist";
    data: any;
}) {
    if (params.actorRole !== "admin") {
        throw forbidden("Apenas admin pode alterar home-info");
    }

    const heroImages = normalizeHeroImages(params.data?.hero_images);
    const heroImage = String(params.data?.hero_image || "").trim();

    const barberPaymentFrequency = normalizePayrollFrequency(
        params.data?.barber_payment_frequency ??
            params.data?.barberPaymentFrequency,
    );

    const employeePaymentFrequency = normalizePayrollFrequency(
        params.data?.employee_payment_frequency ??
            params.data?.employeePaymentFrequency,
    );

    const normalizedData = {
        ...params.data,
        hero_title: params.data?.hero_title ?? null,
        hero_subtitle: params.data?.hero_subtitle ?? null,
        hero_image: heroImage || heroImages[0] || null,
        hero_images: heroImages,
        schedule_title: normalizeScheduleField(params.data?.schedule_title ?? params.data?.scheduleTitle),
        schedule_line1: normalizeScheduleField(params.data?.schedule_line1 ?? params.data?.scheduleLine1),
        schedule_line2: normalizeScheduleField(params.data?.schedule_line2 ?? params.data?.scheduleLine2),
        schedule_line3: normalizeScheduleField(params.data?.schedule_line3 ?? params.data?.scheduleLine3),
        barber_payment_frequency: barberPaymentFrequency,
        employee_payment_frequency: employeePaymentFrequency,
    };

    delete normalizedData.barberPaymentFrequency;
    delete normalizedData.employeePaymentFrequency;

    return upsertHomeInfoByBarbershop(params.barbershopId, {
        barbershop_id: params.barbershopId,
        ...normalizedData,
    });
}
