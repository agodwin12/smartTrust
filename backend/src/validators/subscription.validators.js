const { z } = require("zod");
const { KPAY_PROVIDERS } = require("../utils/kpayProviders");

const checkoutSchema = z.object({
  planId: z.string().min(1, "planId is required."),
  provider: z.enum(KPAY_PROVIDERS),
  phoneNumber: z.string().trim().min(8, "Enter a valid Mobile Money number."),
});

module.exports = { checkoutSchema };
