const { z } = require("zod");
const { KPAY_PROVIDERS } = require("../utils/kpayProviders");

const requestWithdrawalSchema = z.object({
  provider: z.enum(KPAY_PROVIDERS),
  phoneNumber: z.string().trim().min(8, "Enter a valid Mobile Money number."),
  // K-Pay's own floor for a Cameroon-zone payout is 100 XAF — reject below that
  // here instead of burning a K-Pay call (and a wallet reservation) to find out.
  amount: z.number().min(100, "Minimum withdrawal is 100 XAF."),
});

module.exports = { requestWithdrawalSchema };
