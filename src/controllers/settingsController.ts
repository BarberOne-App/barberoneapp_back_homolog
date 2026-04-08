import type { Request, Response } from "express";
import {
    getSettingsService,
    upsertSettingsService,
    getHomeInfoService,
    upsertHomeInfoService,
} from "../services/settingService.js";

export async function getSettings(req: Request, res: Response) {
    const result = await getSettingsService(req.user!.barbershopId);
    return res.status(200).send(result);
}

export async function upsertSettings(req: Request, res: Response) {
    const result = await upsertSettingsService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role as "admin" | "barber" | "client" | "receptionist",
        pixKey: req.body?.pixKey,
        termsDocumentUrl: req.body?.termsDocumentUrl,
        termsDocumentName: req.body?.termsDocumentName,
        hiddenBookingPaymentMethods: req.body?.hiddenBookingPaymentMethods,
    });
    return res.status(200).send(result);
}

export async function getHomeInfo(req: Request, res: Response) {
    const result = await getHomeInfoService(req.user!.barbershopId);
    return res.status(200).send(result);
}

export async function upsertHomeInfo(req: Request, res: Response) {
    const result = await upsertHomeInfoService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role,
        data: req.body,
    });
    return res.status(200).send(result);
}
