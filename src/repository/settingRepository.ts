import prisma from "../database/database.js";
import type { Prisma } from "@prisma/client";

export function getSettingsByBarbershop(barbershopId: string) {
    return prisma.barbershop_settings.findUnique({
        where: { barbershop_id: barbershopId },
    });
}

export function upsertSettingsByBarbershop(
    barbershopId: string,
    data: {
        pix_key?: string | null;
        terms_document_url?: string | null;
        terms_document_name?: string | null;
    }
) {
    return prisma.barbershop_settings.upsert({
        where: { barbershop_id: barbershopId },
        update: {
            pix_key: data.pix_key ?? null,
            terms_document_url: data.terms_document_url ?? null,
            terms_document_name: data.terms_document_name ?? null,
        },
        create: {
            barbershop_id: barbershopId,
            pix_key: data.pix_key ?? null,
            terms_document_url: data.terms_document_url ?? null,
            terms_document_name: data.terms_document_name ?? null,
        },
    });
}

export function getHomeInfoByBarbershop(barbershopId: string) {
    return prisma.barbershop_home_info.findUnique({
        where: { barbershop_id: barbershopId },
    });
}

export function upsertHomeInfoByBarbershop(
    barbershopId: string,
    data: Prisma.barbershop_home_infoUncheckedCreateInput
) {
    // como barbershop_id é unique, dá pra upsert por ele
    return prisma.barbershop_home_info.upsert({
        where: { barbershop_id: barbershopId },
        update: {
            about_title: data.about_title ?? null,
            about_text1: data.about_text1 ?? null,
            about_text2: data.about_text2 ?? null,
            about_text3: data.about_text3 ?? null,
            schedule_title: data.schedule_title ?? null,
            schedule_line1: data.schedule_line1 ?? null,
            schedule_line2: data.schedule_line2 ?? null,
            schedule_line3: data.schedule_line3 ?? null,
            location_title: data.location_title ?? null,
            location_address: data.location_address ?? null,
            location_city: data.location_city ?? null,
        },
        create: {
            barbershop_id: barbershopId,
            about_title: data.about_title ?? null,
            about_text1: data.about_text1 ?? null,
            about_text2: data.about_text2 ?? null,
            about_text3: data.about_text3 ?? null,
            schedule_title: data.schedule_title ?? null,
            schedule_line1: data.schedule_line1 ?? null,
            schedule_line2: data.schedule_line2 ?? null,
            schedule_line3: data.schedule_line3 ?? null,
            location_title: data.location_title ?? null,
            location_address: data.location_address ?? null,
            location_city: data.location_city ?? null,
        },
    });
}
