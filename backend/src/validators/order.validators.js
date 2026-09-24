const { z } = require("zod");
const { KPAY_PROVIDERS } = require("../utils/kpayProviders");

const PAYMENT_METHODS = ["MOBILE_MONEY", "CASH_ON_DELIVERY"];

const createOrderSchema = z
  .object({
    advertisementId: z.string().min(1, "advertisementId is required."),
    quantity: z.number().int().positive().max(999).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).default("MOBILE_MONEY"),
    deliveryAddress: z.string().trim().min(5, "Enter a delivery address.").max(500).optional(),
    deliveryPhone: z.string().trim().min(8, "Enter a valid phone number.").max(30).optional(),
  })
  .refine((data) => data.paymentMethod !== "CASH_ON_DELIVERY" || (data.deliveryAddress && data.deliveryPhone), {
    message: "Cash on delivery needs a delivery address and a phone number.",
    path: ["deliveryAddress"],
  });

const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

const payOrderSchema = z.object({
  provider: z.enum(KPAY_PROVIDERS),
  phoneNumber: z.string().trim().min(8, "Enter a valid Mobile Money number."),
});

const disputeSchema = z.object({
  reason: z.string().trim().min(10, "Explain the issue in a bit more detail.").max(2000),
});

module.exports = { createOrderSchema, payOrderSchema, disputeSchema, cancelOrderSchema, PAYMENT_METHODS };
