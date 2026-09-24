const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const compression = require("compression");

const { corsOrigin, nodeEnv } = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const { requestId, requestLogger } = require("./middlewares/requestContext");
const sentry = require("./config/sentry");
const { generalApiRateLimiter } = require("./middlewares/rateLimiter");

const app = express();

// Needed for rate-limit/cookie handling behind a reverse proxy in production (correct req.ip).
app.set("trust proxy", 1);
// Every request gets an id (echoed as x-request-id) before anything can log or fail.
app.use(requestId);

app.use(helmet());
// gzip/brotli for JSON responses — listing pages are the bulk of traffic and
// compress 5–10x, which matters more for bandwidth-constrained mobile users than
// it does for the server.
app.use(compression());
// credentials:true + a specific origin (never "*") is required for the httpOnly refresh
// cookie to be sent cross-origin from the frontend, and doubles as CSRF hardening —
// a foreign origin's request is rejected by the CORS preflight before it reaches a route.
app.use(cors({ origin: corsOrigin, credentials: true }));
// Captures the exact raw bytes alongside the parsed body — the K-Pay webhook signature
// is computed over the raw request, not a re-serialization of req.body (see kpay.service.js).
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Structured access log (pino) — one JSON line per request with requestId, status and duration.
if (nodeEnv !== "test") app.use(requestLogger);

// Baseline rate limit across the whole API — endpoint-specific limiters (auth,
// OTP requests) still apply on top of this for the sensitive routes.
app.use("/api", generalApiRateLimiter, routes);

app.use(notFound);
// Sentry (no-op without SENTRY_DSN) sees the error first, then our JSON error response.
sentry.attachToApp(app);
app.use(errorHandler);

module.exports = app;
