const { z } = require("zod");
const { KPAY_PROVIDERS } = require("../utils/kpayProviders");

/** Staff may correct the destination before re-issuing a failed refund. */
const retryRefundSchema = z.object({
  operator: z.enum(KPAY_PROVIDERS).optional(),
  phoneNumber: z.string().trim().min(8, "Enter a valid Mobile Money number.").optional(),
});

module.exports = { retryRefundSchema };
