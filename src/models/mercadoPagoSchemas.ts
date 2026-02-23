import Joi from "joi";

/* ═══════ Checkout Pro (Preferência) ═══════ */

export const CreateCheckoutSchema = Joi.object({
  /** TODO: voltar para .uuid() quando auth estiver integrado no frontend */
  barbershopId: Joi.string().optional(),
  userId: Joi.string().optional(),

  appointmentId: Joi.string().optional(),
  items: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        unitPrice: Joi.number().positive().required(),
        description: Joi.string().optional().allow(""),
      })
    )
    .min(1)
    .required(),
  payer: Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().optional().allow(""),
  }).required(),
  backUrls: Joi.object({
    success: Joi.string().uri().optional().allow(""),
    failure: Joi.string().uri().optional().allow(""),
    pending: Joi.string().uri().optional().allow(""),
  }).optional(),
});

/* ═══════ Checkout Transparente — process_payment ═══════ */

export const ProcessPaymentSchema = Joi.object({
  /** TODO: voltar para .uuid() quando auth estiver integrado no frontend */
  barbershopId: Joi.string().optional(),
  userId: Joi.string().optional(),

  appointmentId: Joi.string().optional(),
  transactionAmount: Joi.number().positive().required(),
  description: Joi.string().required(),
  token: Joi.string().optional(),              // obrigatório para cartão
  issuerId: Joi.string().optional().allow(""),
  paymentMethodId: Joi.string().required(),    // visa, master, pix, bolbradesco, etc.
  installments: Joi.number().integer().min(1).optional().default(1),
  payer: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().optional().allow(""),
    lastName: Joi.string().optional().allow(""),
    identification: Joi.object({
      type: Joi.string().valid("CPF", "CNPJ").required(),
      number: Joi.string().required(),
    }).optional(),
    address: Joi.object({
      zipCode: Joi.string().optional().allow(""),
      streetName: Joi.string().optional().allow(""),
      streetNumber: Joi.string().optional().allow(""),
      neighborhood: Joi.string().optional().allow(""),
      city: Joi.string().optional().allow(""),
      federalUnit: Joi.string().max(2).optional().allow(""),
    }).optional(),
  }).required(),
});

/* ═══════ PIX (retrocompatibilidade) ═══════ */

export const CreatePixSchema = Joi.object({
  /** TODO: voltar para .uuid() quando auth estiver integrado no frontend */
  barbershopId: Joi.string().optional(),
  userId: Joi.string().optional(),

  appointmentId: Joi.string().optional(),
  amount: Joi.number().positive().required(),
  description: Joi.string().required(),
  payer: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().optional().allow(""),
    lastName: Joi.string().optional().allow(""),
    cpf: Joi.string()
      .pattern(/^\d{11}$/)
      .optional()
      .messages({ "string.pattern.base": "CPF deve conter 11 dígitos numéricos" }),
  }).required(),
});

/* ═══════ Consultar status ═══════ */

export const TransactionIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});
