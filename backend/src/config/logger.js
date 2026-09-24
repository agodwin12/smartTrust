const pino = require("pino");

/**
 * One structured logger for the whole API. JSON lines in production (ready for
 * Loki / CloudWatch / Datadog), pretty-printed in development when pino-pretty is
 * installed. Every request log carries a requestId (see middlewares/requestContext.js)
 * so a support ticket's `x-request-id` can be grepped straight to its log lines.
 *
 * Usage: logger.info({ orderId }, "escrow released") — bindings object first, message
 * second. Pass errors as { err } so pino serialises the stack.
 */
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
const pretty = process.env.NODE_ENV !== "production" && process.env.LOG_PRETTY !== "false";

let transport;
if (pretty) {
  try {
    require.resolve("pino-pretty");
    transport = { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } };
  } catch {
    transport = undefined; // pino-pretty is a dev dependency; fall back to JSON
  }
}

const logger = pino({
  level,
  base: { service: "smart-market-api" },
  redact: {
    // Never let a password, token or Mobile Money PIN land in a log line.
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.newPassword", "*.currentPassword", "*.pin", "*.accessToken", "*.refreshToken"],
    censor: "[redacted]",
  },
  ...(transport && { transport }),
});

module.exports = logger;
