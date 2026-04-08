import { forbidden } from "../errors/index.js";
import {
    getSettingsByBarbershop,
    upsertSettingsByBarbershop,
    getHomeInfoByBarbershop,
    upsertHomeInfoByBarbershop,
} from "../repository/settingRepository.js";

export async function getSettingsService(barbershopId: string) {
    const row = await getSettingsByBarbershop(barbershopId);
    const hiddenBookingPaymentMethods = Array.isArray((row as any)?.hidden_booking_payment_methods)
        ? (row as any).hidden_booking_payment_methods
        : [];

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
    if (params.actorRole !== "admin") throw forbidden("Apenas admin pode alterar configurações");

    const hiddenBookingPaymentMethods = Array.isArray(params.hiddenBookingPaymentMethods)
        ? params.hiddenBookingPaymentMethods
            .map((value) => String(value || "").trim().toLowerCase())
            .filter((value) => value === "online" || value === "local")
        : [];

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
        hiddenBookingPaymentMethods: Array.isArray((row as any)?.hidden_booking_payment_methods)
            ? (row as any).hidden_booking_payment_methods
            : [],
    };
}

export async function getHomeInfoService(barbershopId: string) {
    const row = await getHomeInfoByBarbershop(barbershopId);

    // se ainda não existir, você pode devolver defaults aqui
    return row ?? {
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
    };
}

export async function upsertHomeInfoService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client";
    data: any; // se quiser eu te deixo Joi/Types certinho depois
}) {
    if (params.actorRole !== "admin") throw forbidden("Apenas admin pode alterar home-info");

    return upsertHomeInfoByBarbershop(params.barbershopId, {
        barbershop_id: params.barbershopId,
        ...params.data,
    });
}
