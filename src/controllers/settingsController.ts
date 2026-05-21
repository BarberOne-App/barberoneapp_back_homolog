import type { Request, Response } from "express";
import {
    getSettingsService,
    upsertSettingsService,
    getHomeInfoService,
    upsertHomeInfoService,
} from "../services/settingService.js";

const VALID_SLOT_INTERVALS = [5, 10, 15, 30];

export async function getSettings(req: Request, res: Response) {
    try {
        const result = await getSettingsService(req.user!.barbershopId);
        return res.status(200).json(result);
    } catch (error: any) {
        console.error("Erro ao buscar configurações:", error);
        return res.status(500).json({ message: "Erro interno ao buscar configurações" });
    }
}

export async function upsertSettings(req: Request, res: Response) {
    try {
        const { slotIntervalMinutes } = req.body ?? {};

        if (slotIntervalMinutes !== undefined) {
            const n = Number(slotIntervalMinutes);
            if (!VALID_SLOT_INTERVALS.includes(n)) {
                return res.status(400).json({
                    message: `slotIntervalMinutes deve ser um dos valores: ${VALID_SLOT_INTERVALS.join(", ")}`,
                });
            }
        }

        const result = await upsertSettingsService({
            barbershopId: req.user!.barbershopId,
            actorRole: req.user!.role as "admin" | "barber" | "client" | "receptionist",
            pixKey: req.body?.pixKey,
            termsDocumentUrl: req.body?.termsDocumentUrl,
            termsDocumentName: req.body?.termsDocumentName,
            hiddenBookingPaymentMethods: req.body?.hiddenBookingPaymentMethods,
            slotIntervalMinutes: slotIntervalMinutes !== undefined ? Number(slotIntervalMinutes) : undefined,
        });

        return res.status(200).json(result);
    } catch (error: any) {
        if (error?.statusCode === 403 || error?.status === 403) {
            return res.status(403).json({ message: error.message ?? "Acesso negado" });
        }
        console.error("Erro ao salvar configurações:", error);
        return res.status(500).json({ message: "Erro interno ao salvar configurações" });
    }
}

export async function getHomeInfo(req: Request, res: Response) {
    try {
        const result = await getHomeInfoService(req.user!.barbershopId);
        return res.status(200).json(result);
    } catch (error: any) {
        console.error("Erro ao buscar home-info:", error);
        return res.status(500).json({ message: "Erro interno ao buscar informações da home" });
    }
}

export async function upsertHomeInfo(req: Request, res: Response) {
    try {
        const result = await upsertHomeInfoService({
            barbershopId: req.user!.barbershopId,
            actorRole: req.user!.role as "admin" | "barber" | "client",
            data: req.body,
        });
        return res.status(200).json(result);
    } catch (error: any) {
        if (error?.statusCode === 403 || error?.status === 403) {
            return res.status(403).json({ message: error.message ?? "Acesso negado" });
        }
        console.error("Erro ao salvar home-info:", error);
        return res.status(500).json({ message: "Erro interno ao salvar informações da home" });
    }
}
