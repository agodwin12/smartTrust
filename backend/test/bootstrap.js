/**
 * First require of every test file. Pins the environment BEFORE src/config/env.js loads,
 * so the app under test talks to the *_test database, a separate Redis database, and
 * never reaches a real payment/email provider.
 */
const path = require("path");
const { testDatabaseUrl } = require("./db-url");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl();
process.env.REDIS_URL = process.env.TEST_REDIS_URL || "redis://localhost:6379/9";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.JOBS_ENABLED = "false";
process.env.LOG_LEVEL = "silent";
process.env.LOG_PRETTY = "false";
process.env.JWT_ACCESS_SECRET = "test-access-secret-not-for-production";
process.env.JWT_ACCESS_TTL = "15m";
process.env.BCRYPT_SALT_ROUNDS = "4"; // fast hashing; strength is irrelevant in tests
process.env.KPAY_API_KEY = "test";
process.env.KPAY_SECRET_KEY = "test";
process.env.KPAY_WEBHOOK_SECRET = "test-webhook-secret";
process.env.KPAY_GATEWAY_SECRET = "test-gateway-secret";
process.env.KPAY_BASE_URL = "http://127.0.0.1:9"; // closed port: every provider call fails fast
process.env.RESEND_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.SENTRY_DSN = "";
process.env.GENERAL_RATE_LIMIT_PER_MINUTE = "100000";
