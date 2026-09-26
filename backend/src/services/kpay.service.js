const crypto = require("crypto");
const { kpay } = require("../config/env");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");

function authHeaders() {
  return {
    "X-API-Key": kpay.apiKey,
    "X-Secret-Key": kpay.secretKey,
    "Content-Type": "application/json",
  };
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Only ever retry what's actually safe and likely to succeed on a second try:
// a network-level failure (no response at all), a 5xx from K-Pay's side, or a
// 429 rate limit. A 400/401/403/409/422 is a deterministic outcome — the exact
// same request would fail the exact same way, so retrying it would just waste
// K-Pay's stated 100 req/min budget. This is safe to retry blindly because
// every write call (`initPayment`/`initWithdrawal`) is built around a caller-
// supplied `externalId` — the SAME externalId on a retry is exactly what
// K-Pay's own idempotency key is for.
function isRetryable(err) {
  if (err.isNetworkError) return true;
  return err.upstreamStatus === 429 || (err.upstreamStatus >= 500 && err.upstreamStatus < 600);
}

// What the CLIENT sees. K-Pay's 400/422 mean the caller's own input was bad
// (amount below the minimum, malformed phone number) — worth surfacing as 422.
// Everything else — 401/403 (OUR credentials), 409 (OUR externalId reuse), 5xx —
// is not the client's fault and must not be passed through as-is: a raw 401 in
// particular would make a frontend think the USER's session expired and log
// them out over a payment-provider misconfiguration.
function clientStatusFor(upstreamStatus) {
  return upstreamStatus === 400 || upstreamStatus === 422 ? 422 : 502;
}

async function request(method, path, body) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      let res;
      try {
        // Without a timeout, a K-Pay outage would leave every checkout request
        // hanging with an open socket and a held DB connection — under load that
        // is how a third-party hiccup becomes our own outage.
        res = await fetch(`${kpay.baseUrl}${path}`, {
          method,
          headers: authHeaders(),
          signal: AbortSignal.timeout(10_000),
          ...(body && { body: JSON.stringify(body) }),
        });
      } catch (networkErr) {
        const err = new ApiError(502, `K-Pay request failed: ${networkErr.message}`, "KPAY_NETWORK_ERROR");
        err.isNetworkError = true;
        throw err;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = new ApiError(clientStatusFor(res.status), data.message || "K-Pay request failed.", "KPAY_ERROR");
        err.upstreamStatus = res.status; // K-Pay's own status, for the retry decision only
        throw err;
      }

      return data;
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS || !isRetryable(err)) throw err;

      // Exponential backoff with jitter: ~300ms, ~600-900ms, ... — keeps a single
      // request's worst case well under typical client/gateway timeouts.
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * BASE_DELAY_MS;
      logger.warn({ method, path, attempt, maxAttempts: MAX_ATTEMPTS, retryInMs: Math.round(delay), err: err.message }, "K-Pay request failed, retrying");
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * USSD mode: charges a specific Mobile Money number directly — the customer
 * gets a push notification on their phone to approve. This is the "Mobile
 * Money / Orange Money" flow (provider e.g. MTN_MOMO_CMR, ORANGE_CMR).
 */
function initPayment({ amount, provider, phoneNumber, externalId, description, customerName, customerEmail, metadata }) {
  return request("POST", "/payments/init", {
    amount,
    provider,
    phoneNumber,
    externalId,
    ...(description && { description }),
    ...(customerName && { customerName }),
    ...(customerEmail && { customerEmail }),
    ...(metadata && { metadata }),
  });
}

/**
 * GATEWAY mode: K-Pay hosts the payment page and the customer picks their own
 * operator/card there. Not wired into any checkout flow yet — kept here ready
 * for reuse (e.g. a future card-payment option).
 */
function initGatewayPayment({ amount, externalId, returnUrl, successUrl, cancelUrl, description, metadata }) {
  return request("POST", "/payments/init", {
    amount,
    externalId,
    returnUrl,
    ...(successUrl && { successUrl }),
    ...(cancelUrl && { cancelUrl }),
    ...(description && { description }),
    ...(metadata && { metadata }),
  });
}

/** id can be either K-Pay's `id` (pay_...) or its `reference` (KPAY-...) — both accepted. */
function getPaymentStatus(idOrReference) {
  return request("GET", `/payments/${encodeURIComponent(idOrReference)}`);
}

function predictProvider(phoneNumber) {
  return request("POST", "/payments/predict-provider", { phoneNumber });
}

/**
 * Sends funds FROM SmartPlaze's own K-Pay wallet TO a beneficiary's Mobile
 * Money number — this is how a seller cashes out their internal Wallet.balance.
 * Draws down the platform's aggregate K-Pay balance (built up from collected
 * payments), not any per-seller account at K-Pay itself.
 */
function initWithdrawal({ amount, provider, phoneNumber, externalId, description, metadata }) {
  return request("POST", "/payments/withdraw", {
    amount,
    provider,
    phoneNumber,
    ...(externalId && { externalId }),
    ...(description && { description }),
    ...(metadata && { metadata }),
  });
}

function getWithdrawalStatus(idOrReference) {
  return request("GET", `/payments/withdraw/${encodeURIComponent(idOrReference)}`);
}

/** Webhook signature: HMAC-SHA256(rawBody, KPAY_WEBHOOK_SECRET) hex, header X-KPAY-Signature. */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  const expected = crypto.createHmac("sha256", kpay.webhookSecret).update(rawBody).digest("hex");

  const provided = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  return provided.length === expectedBuf.length && crypto.timingSafeEqual(provided, expectedBuf);
}

/**
 * GATEWAY-mode return redirect: {status,reference,externalId,ts,sig} in the query
 * string. Verifies the signature AND that ts is recent (anti-replay) — per K-Pay's
 * docs this is only ever a UX hint, the actual payment must still be confirmed via
 * getPaymentStatus() before anything is marked paid.
 */
function verifyGatewayReturn(query) {
  const { status, reference, externalId = "", ts, sig } = query;
  if (!status || !reference || !ts || !sig) return false;

  const stringToSign = `${status}|${reference}|${externalId}|${ts}`;
  const expected = crypto.createHmac("sha256", kpay.gatewaySecret).update(stringToSign).digest("hex");

  const provided = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  const sigOk = provided.length === expectedBuf.length && crypto.timingSafeEqual(provided, expectedBuf);

  return sigOk && Date.now() - Number(ts) < 10 * 60 * 1000;
}

module.exports = {
  initPayment,
  initGatewayPayment,
  getPaymentStatus,
  predictProvider,
  initWithdrawal,
  getWithdrawalStatus,
  verifyWebhookSignature,
  verifyGatewayReturn,
};
