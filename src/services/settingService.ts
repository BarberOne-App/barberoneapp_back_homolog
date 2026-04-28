import { forbidden } from "../errors/index.js";
import {
    getSettingsByBarbershop,
    upsertSettingsByBarbershop,
    getHomeInfoByBarbershop,
    upsertHomeInfoByBarbershop,
} from "../repository/settingRepository.js";

type PayrollFrequency = "weekly" | "biweekly" | "monthly";

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

export async function getSettingsService(barbershopId: string) {
    const row = await getSettingsByBarbershop(barbershopId);
    const hiddenBookingPaymentMethods = normalizeHiddenBookingPaymentMethods(
        (row as any)?.hidden_booking_payment_methods,
    );

    return {
        pixKey: row?.pix_key ?? "",
        termsDocumentUrl: row?.terms_document_url ?? "",
        termsDocumentName: row?.terms_document_name ?? "",
        hiddenBookingPaymentMethods,
    };
}

export async function upsertSettingsService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client" | "receptionist";
    pixKey?: string;
    termsDocumentUrl?: string;
    termsDocumentName?: string;
    hiddenBookingPaymentMethods?: string[];
}) {
    if (params.actorRole !== "admin") {
        throw forbidden("Apenas admin pode alterar configurações");
    }

    const hiddenBookingPaymentMethods = normalizeHiddenBookingPaymentMethods(
        params.hiddenBookingPaymentMethods,
    );

    const row = await upsertSettingsByBarbershop(params.barbershopId, {
        pix_key: params.pixKey ?? "",
        terms_document_url: params.termsDocumentUrl ?? null,
        terms_document_name: params.termsDocumentName ?? null,
        hidden_booking_payment_methods: hiddenBookingPaymentMethods,
    });

    return {
        pixKey: row.pix_key ?? "",
        termsDocumentUrl: row.terms_document_url ?? "",
        termsDocumentName: row.terms_document_name ?? "",
        hiddenBookingPaymentMethods: normalizeHiddenBookingPaymentMethods(
            (row as any)?.hidden_booking_payment_methods,
        ),
    };
}

export async function getHomeInfoService(barbershopId: string) {
    const row = await getHomeInfoByBarbershop(barbershopId);

    if (row) {
        const heroImages = normalizeHeroImages((row as any)?.hero_images);

        return {
            ...row,
            hero_images: heroImages,
            barber_payment_frequency:
                normalizePayrollFrequency((row as any)?.barber_payment_frequency) ?? null,
            employee_payment_frequency:
                normalizePayrollFrequency((row as any)?.employee_payment_frequency) ?? null,
        };
    }

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
        schedule_line1: "Seg - 14h as 20h",
        schedule_line2: "Terça a Sab. - 09h as 20h",
        schedule_line3: "Domingo: Fechado",
        whatsapp_number: "",
        location_title: "Localização",
        location_address: "Av. val paraíso,1396",
        location_city: "Jangurussu - Fortaleza/CE",
        barber_payment_frequency: null,
        employee_payment_frequency: null,
    };
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