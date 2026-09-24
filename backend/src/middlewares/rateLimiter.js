const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("../config/redis");

// Backed by Redis so every limit below is GLOBAL across every app instance behind
// a load balancer — an in-memory store (express-rate-limit's default) counts
// separately per process, which silently multiplies the effective limit by
// however many instances are running. `passOnStoreError: true` on every limiter
// is what keeps Redis from becoming a new single point of failure: if it's briefly
// unreachable, the store call rejects and express-rate-limit just allows the
// request through unlimited for that moment, rather than 500ing every request
// platform-wide.
// Waits (briefly) for the shared client to be usable. At boot the limiters are built before
// ioredis has finished connecting, and with enableOfflineQueue:false a command sent in that
// window fails instantly; during a real outage the wait is short so requests still fail open fast.
// One shared wait so six limiters booting together add one listener, not six. At boot
// (status "connecting") we allow a few seconds; during an outage ("reconnecting"/"end") the
// wait is short so requests still fail open quickly.
let readyWait = null;
function whenReady() {
  if (redis.status === "ready") return Promise.resolve();
  if (readyWait) return readyWait;
  const timeoutMs = redis.status === "connecting" || redis.status === "wait" ? 5000 : 500;
  readyWait = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      redis.off("ready", onReady);
      reject(new Error("Redis not ready"));
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    redis.once("ready", onReady);
  }).finally(() => {
    readyWait = null;
  });
  return readyWait;
}

/**
 * rate-limit-redis memoises the promise that loads its Lua scripts at init(). If that first
 * load fails (Redis not connected yet), the rejected promise is reused for every later
 * request and the limiter silently never limits again. These accessors drop a rejected
 * promise so the next request simply loads the script again.
 */
function selfHealingScript(store, prop) {
  let cached = null;
  const remember = (promise) => {
    cached = Promise.resolve(promise).catch((err) => {
      cached = null;
      throw err;
    });
    return cached;
  };
  Object.defineProperty(store, prop, {
    configurable: true,
    get: () => cached ?? remember(prop === "incrementScriptSha" ? store.loadIncrementScript() : store.loadGetScript()),
    set: (promise) => remember(promise),
  });
}

function makeLimiter({ prefix, windowMs, limit, message }) {
  const store = new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: async (...args) => {
      await whenReady();
      return redis.call(...args);
    },
  });
  selfHealingScript(store, "incrementScriptSha");
  selfHealingScript(store, "getScriptSha");

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    // The automated tests hammer the auth endpoints from one IP; they opt out explicitly.
    skip: () => process.env.RATE_LIMIT_DISABLED === "true",
    message: { error: message, code: "RATE_LIMITED" },
    store,
  });
}

// register/login: a real user won't hit 20 attempts in 15 minutes.
const authRateLimiter = makeLimiter({
  prefix: "auth",
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many attempts. Please try again later.",
});

// forgot-password / resend-verification: these each SEND AN EMAIL — the limit here
// isn't about guessing, it's about not letting someone spam a stranger's inbox (or
// burn through the Resend quota) by repeatedly requesting codes for the same or
// different addresses.
const otpRequestRateLimiter = makeLimiter({
  prefix: "otp-request",
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many code requests. Please wait before requesting another.",
});

// verify-email / reset-password: guessing attempts. OtpCode.attempts already caps
// guesses against one specific code; this is the per-IP backstop against spreading
// guesses across many codes/accounts.
const otpVerifyRateLimiter = makeLimiter({
  prefix: "otp-verify",
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many attempts. Please wait before trying again.",
});

// Baseline abuse/DoS protection applied to the whole API (app.js) — generous
// enough that normal browsing never comes close, just a backstop against basic
// scraping/flooding at the "hundreds of concurrent users" scale this app targets.
const generalApiRateLimiter = makeLimiter({
  prefix: "api",
  windowMs: 60 * 1000,
  // Tunable so a load test (or a busy proxy) can raise it without a code change.
  limit: parseInt(process.env.GENERAL_RATE_LIMIT_PER_MINUTE || "120", 10),
  message: "Too many requests. Please slow down.",
});

// Image uploads land in memory (multer) before going to R2 — up to 8 × 5MB per
// request. Without a limiter, one client hammering the upload endpoints is a
// cheap way to exhaust the process's memory.
const uploadRateLimiter = makeLimiter({
  prefix: "upload",
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: "Too many uploads. Please wait before uploading more.",
});

// Assistant: every call costs model tokens, so a tight per-IP budget (30 messages / 10 min).
const assistantRateLimiter = makeLimiter({
  prefix: "assistant",
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: "You are sending messages too quickly. Please wait a few minutes.",
});

module.exports = {
  assistantRateLimiter,
  authRateLimiter,
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
  generalApiRateLimiter,
  uploadRateLimiter,
};
