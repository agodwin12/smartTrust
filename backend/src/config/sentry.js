const Sentry = require("@sentry/node");
const logger = require("./logger");

/**
 * Error tracking is opt-in: with no SENTRY_DSN (or outside production) the SDK is never initialised and every
 * helper below is a cheap no-op, so local development and the tests run exactly as before.
 * Initialise as early as possible (server.js requires this before the app) so the SDK
 * can instrument http/pg/ioredis.
 */
const dsn = process.env.SENTRY_DSN;
// Only deployed servers report by default: a developer's PC (Postgres asleep, laptop under load)
// would otherwise flood the project with local noise. Set SENTRY_ENABLE_IN_DEV=true to test locally.
const deployed = process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLE_IN_DEV === "true";
const enabled = Boolean(dsn) && deployed;

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    sendDefaultPii: false,
  });
  logger.info({ environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV }, "Sentry error tracking enabled");
}

/** Mounts Sentry's Express error handler (must come before our own errorHandler). */
function attachToApp(app) {
  if (!enabled) return;
  if (typeof Sentry.setupExpressErrorHandler === "function") Sentry.setupExpressErrorHandler(app);
}

/** Reports an error that was handled outside the request pipeline (jobs, unhandled rejections). */
function captureException(error, context) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext("details", context);
    Sentry.captureException(error);
  });
}

module.exports = { enabled, attachToApp, captureException };
