// src/controllers/efiPaymentController.ts

import { Request, Response } from 'express';
import { createEfiCardPaymentService } from '../services/efiPaymentService.js';

function getEfiData(response: any) {
  return response?.data || response;
}

function normalizeStatus(status?: string) {
  return String(status || '').toLowerCase();
}

export async function createEfiCardPaymentController(req: Request, res: Response) {
  try {
    const {
      amount,
      paymentToken,
      cardMask,
      installments,
      description,
      customer,
      metadata,
      split,
    } = req.body;

    const efiResponse = await createEfiCardPaymentService({
      amount: Number(amount),
      paymentToken,
      installments: Number(installments || 1),
      description,
      customer,
      metadata,
      split,
    });

    const data = getEfiData(efiResponse);
    const status = normalizeStatus(data?.status);

    return res.status(200).json({
      provider: 'efi',
      charge_id: data?.charge_id,
      chargeId: data?.charge_id,
      status,
      total: data?.total,
      payment: data?.payment,
      installments: data?.installments,
      installment_value: data?.installment_value,
      cardMask,
      raw: efiResponse,
    });
  } catch (error: any) {
    console.error('Erro ao processar pagamento Efí:', error);

    return res.status(400).json({
      message: error?.message || 'Erro ao processar pagamento via Efí.',
    });
  }
}