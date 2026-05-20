import {
    createPagarmeOrderService,
    createPagarmeRecipientService,
    getPagarmeOrderStatusService,
    normalizePagarmeOrder,
} from '../services/pagarmeOrderService.js';
import prisma from '../database/database.js';
import { Request, Response, NextFunction } from 'express';

export async function createPagarmeOrderController(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await createPagarmeOrderService(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
}

export async function getPagarmeOrderStatusController(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await getPagarmeOrderStatusService(req.params.orderId);
        return res.json(result);
    } catch (error) {
        return next(error);
    }
}

export async function createPagarmeRecipientController(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await createPagarmeRecipientService(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
}

// Configure essa URL no Dashboard Pagar.me.
// Ela é importante porque PIX e alguns status podem ser assíncronos.
export async function pagarmeWebhookController(req: Request, res: Response, next: NextFunction) {
    try {
        const eventType = req.body?.type || req.body?.event || '';
        const eventData = req.body?.data || req.body?.order || req.body;
        const order = eventData?.object === 'order' || eventData?.charges ? eventData : eventData?.order || eventData;
        const normalized = normalizePagarmeOrder(order);

        const metadata = order?.metadata || {};
        const paymentId = metadata.paymentId;
        const appointmentId = metadata.appointmentId;

        const isPaid =
            eventType === 'order.paid' ||
            eventType === 'charge.paid' ||
            normalized.status === 'paid' ||
            normalized.chargeStatus === 'paid';

        const isFailed =
            eventType === 'order.payment_failed' ||
            eventType === 'charge.payment_failed' ||
            normalized.status === 'failed' ||
            normalized.chargeStatus === 'failed';

        if ((isPaid || isFailed) && paymentId) {
            // Ajuste para o nome real do seu model/tabela de pagamentos, se necessário.
            //   await prisma.appointment_payments.update({
            //     where: { id: String(paymentId) },
            //     data: {
            //       status: isPaid ? 'paid' : 'failed',
            //       payment_provider: 'pagarme',
            //       payment_method: normalized.paymentMethod === 'pix' ? 'pix' : 'card',
            //       paid_at: isPaid ? new Date() : null,
            //       pagarme_order_id: normalized.orderId,
            //       pagarme_charge_id: normalized.chargeId,
            //       pagarme_status: normalized.status,
            //     },
            //   }).catch(async () => {
            // Fallback caso sua tabela seja payment_transactions.
            await prisma.payment_transactions.update({
                where: { id: String(paymentId) },
                data: {
                    status: isPaid ? 'paid' : 'failed',
                    payment_provider: 'pagarme',
                    payment_method: normalized.paymentMethod === 'pix' ? 'pix' : 'card',
                    paid_at: isPaid ? new Date() : null,
                    pagarme_order_id: normalized.orderId,
                    pagarme_charge_id: normalized.chargeId,
                    pagarme_status: normalized.status,
                },
            });
            //   });
        }

        if (isFailed && appointmentId) {
            // Opcional: se seu fluxo cria agendamento antes do pagamento, você pode cancelar/remover aqui.
            // await prisma.appointments.update({ where: { id: String(appointmentId) }, data: { status: 'cancelled' } });
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        return next(error);
    }
}
