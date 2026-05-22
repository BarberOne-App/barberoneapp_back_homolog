import joi from "joi";

export const CreatePlanSchema = joi.object({
  name: joi.string().trim().required(),
  subtitle: joi.string().allow('', null).optional(),
  price: joi.number().min(0).required(),
  color: joi.string().allow('', null).optional(),
  cutsPerMonth: joi.number().integer().min(0).default(0),
  active: joi.boolean().default(true),
  recommended: joi.boolean().default(false),
  features: joi.array().items(joi.string()).default([]),
  maxBarbers: joi.number().integer().min(0).allow(null).optional(),
  maxReceptionists: joi.number().integer().min(0).allow(null).optional(),
  maxAdmins: joi.number().integer().min(0).allow(null).optional(),

  syncPagarme: joi.boolean().default(true),
});

// export const CreatePlanSchema = joi
//   .object({
//     name: joi.string().trim().min(1).max(100).required(),
//     subtitle: joi.string().trim().allow("", null).optional(),
//     price: joi.number().min(0).required(),
//     color: joi.string().trim().allow("", null).optional(),
//     cutsPerMonth: joi.number().integer().min(0).required(),
//     active: joi.boolean().optional().default(true),
//     recommended: joi.boolean().optional().default(false),
//     syncStripe: joi.boolean().optional().default(true),
//     stripeProductId: joi.string().trim().allow("", null).optional(),
//     stripePriceId: joi.string().trim().allow("", null).optional(),
//     stripePaymentLinkUrl: joi.string().trim().uri().allow("", null).optional(),
//     mpSubscriptionUrl: joi.string().trim().uri().allow("", null).optional(),
//     mpPreapprovalPlanId: joi.string().trim().allow("", null).optional(),
//     features: joi.array().items(joi.string().trim().min(1)).optional().default([]),
//   })
//   .options({ abortEarly: false, stripUnknown: true });

export const UpdatePlanSchema = joi
  .object({
    name: joi.string().trim().min(1).max(100).optional(),
    subtitle: joi.string().trim().allow("", null).optional(),
    price: joi.number().min(0).optional(),
    color: joi.string().trim().allow("", null).optional(),
    cutsPerMonth: joi.number().integer().min(0).optional(),
    active: joi.boolean().optional(),
    recommended: joi.boolean().optional(),
    syncStripe: joi.boolean().optional(),
    stripeProductId: joi.string().trim().allow("", null).optional(),
    stripePriceId: joi.string().trim().allow("", null).optional(),
    stripePaymentLinkUrl: joi.string().trim().uri().allow("", null).optional(),
    mpSubscriptionUrl: joi.string().trim().uri().allow("", null).optional(),
    mpPreapprovalPlanId: joi.string().trim().allow("", null).optional(),
    features: joi.array().items(joi.string().trim().min(1)).optional(),
  })
  .min(1)
  .options({ abortEarly: false, stripUnknown: true });

export const ListPlansQuerySchema = joi
  .object({
    activeOnly: joi.boolean().optional(),
  })
  .unknown(true);

export const PlanIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});
