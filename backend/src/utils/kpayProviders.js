// The full K-Pay Mobile Money provider catalogue (USSD mode) — see kpay.site/documentation/providers.
// Shared by every module that collects or pays out Mobile Money (subscriptions, orders, withdrawals).
const KPAY_PROVIDERS = [
  "MTN_MOMO_BEN",
  "MOOV_BEN",
  "MTN_MOMO_CMR",
  "ORANGE_CMR",
  "MTN_MOMO_CIV",
  "ORANGE_CIV",
  "VODACOM_MPESA_COD",
  "AIRTEL_COD",
  "ORANGE_COD",
  "AIRTEL_GAB",
  "MPESA_KEN",
  "AIRTEL_COG",
  "MTN_MOMO_COG",
  "AIRTEL_RWA",
  "MTN_MOMO_RWA",
  "FREE_SEN",
  "ORANGE_SEN",
  "ORANGE_SLE",
  "AIRTEL_OAPI_UGA",
  "MTN_MOMO_UGA",
  "AIRTEL_OAPI_ZMB",
  "MTN_MOMO_ZMB",
  "ZAMTEL_ZMB",
];

module.exports = { KPAY_PROVIDERS };
