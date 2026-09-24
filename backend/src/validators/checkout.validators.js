const { z } = require("zod");
const { KPAY_PROVIDERS } = require("../utils/kpayProviders");

const PAYMENT_METHODS = ["MOBILE_MONEY", "CASH_ON_DELIVERY"];
const optional = (schema) => schema.optional().or(z.literal("").transform(() => undefined));

const guestSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  phone: z.string().trim().min(8, "Enter a valid phone number.").max(30),
  email: optional(z.string().trim().toLowerCase().email("Enter a valid email address.")),
});

const createCheckoutSchema = z
  .object({
    items: z
      .array(z.object({ advertisementId: z.string().min(1), quantity: z.coerce.number().int().positive().max(999).default(1) }))
      .min(1, "Your cart is empty.")
      .max(50, "Too many items in one order."),
    paymentMethod: z.enum(PAYMENT_METHODS).default("MOBILE_MONEY"),
    deliveryAddress: optional(z.string().trim().min(5, "Enter a delivery address.").max(500)),
    deliveryPhone: optional(z.string().trim().min(8, "Enter a valid phone number.").max(30)),
    guest: guestSchema.optional(),
  })
  .refine((d) => d.paymentMethod !== "CASH_ON_DELIVERY" || (d.deliveryAddress && d.deliveryPhone), {
    message: "Cash on delivery needs a delivery address and a phone number.",
    path: ["deliveryAddress"],
  });

const payCheckoutSchema = z.object({
  provider: z.enum(KPAY_PROVIDERS),
  phoneNumber: z.string().trim().min(8, "Enter a valid Mobile Money number."),
  token: z.string().optional(),
});

const lookupSchema = z.object({
  reference: z.string().trim().min(6).max(20),
  phone: z.string().trim().min(8).max(30),
});

const cancelLineSchema = z.object({ reason: z.string().trim().max(500).optional(), token: z.string().optional() });

module.exports = { createCheckoutSchema, payCheckoutSchema, lookupSchema, cancelLineSchema };
