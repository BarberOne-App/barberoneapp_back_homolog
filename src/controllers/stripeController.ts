import { Request, Response } from "express";
import prisma from "../database/database.js";

export async function getMyActiveSubscription(req: Request, res: Response) {
  const subscription = await prisma.subscriptions.findFirst({
    where: {
      user_id: req.user!.id,
      status: "active",
    },
    orderBy: {
      updated_at: "desc",
    },
    include: {
      subscription_plans: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  });

  if (!subscription) {
    return res.status(200).send(null);
  }

  return res.status(200).send({
    id: subscription.id,
    userId: subscription.user_id,
    planId: subscription.plan_id,
    planName: subscription.subscription_plans?.name ?? null,
    status: subscription.status,
    nextBillingDate: subscription.next_billing_at,
    cancelAtPeriodEnd: !subscription.auto_renewal,
    stripeSubscriptionId: subscription.legacy_id,
  });
}