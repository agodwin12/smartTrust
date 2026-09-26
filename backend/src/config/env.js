require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL,
  // One origin or a comma-separated list (e.g. the apex domain plus a legacy alias during a move).
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:3020").split(",").map((o) => o.trim()).filter(Boolean),
  // Where a browser-redirect flow (Google OAuth) sends the user back to once
  // it's done — a backend API route can't just "return" a token to a page.
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3020",

  // Explicit rather than left to the pg driver's own default (10) — with N app
  // instances each holding up to `max` connections, total = N * max must stay
  // under Postgres's own max_connections. Tune DB_POOL_MAX per instance based
  // on how many instances you actually run.
  dbPool: {
    max: parseInt(process.env.DB_POOL_MAX || "10", 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || "30000", 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_TIMEOUT_MS || "5000", 10),
  },

  auth: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET,
    accessTokenTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "30", 10),
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10),
    cookieName: "refresh_token",
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  },

  // Housekeeping jobs (see src/jobs). Off in tests; JOBS_ENABLED=false turns them off on
  // an instance that should only serve traffic.
  jobs: {
    enabled: process.env.JOBS_ENABLED !== "false" && process.env.NODE_ENV !== "test",
  },

  // Claude-powered shopping assistant. Without an API key the /assistant routes answer
  // 503 ASSISTANT_UNAVAILABLE and the widget falls back to its shortcut chips.
  // Public contact channels shown on the site (WhatsApp bubble, chat hand-off). Digits only for WhatsApp.
  site: {
    whatsapp: (process.env.SUPPORT_WHATSAPP || "").replace(/\D/g, ""),
    supportEmail: process.env.SUPPORT_EMAIL || "",
  },

  assistant: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ASSISTANT_MODEL || "claude-opus-5",
    maxTurns: parseInt(process.env.ASSISTANT_MAX_TOOL_TURNS || "4", 10),
  },

  r2: {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    // The authenticated S3 API endpoint is always accountid.r2.cloudflarestorage.com —
    // NOT the public *.r2.dev domain (that one only serves reads of already-public objects).
    apiEndpoint:
      process.env.CLOUDFLARE_R2_API_ENDPOINT ||
      `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL,
    // Every SmartPlaze object lives under this prefix — the bucket is shared with
    // other projects, so this keeps our files from ever colliding with theirs.
    keyPrefix: "smart-market",
  },

  kpay: {
    baseUrl: (process.env.KPAY_BASE_URL || "https://admin.kpay.site/api/v1").replace(/\/$/, ""),
    apiKey: process.env.KPAY_API_KEY,
    secretKey: process.env.KPAY_SECRET_KEY,
    webhookSecret: process.env.KPAY_WEBHOOK_SECRET,
    gatewaySecret: process.env.KPAY_GATEWAY_SECRET,
  },

  redis: {
    // "redis" as the default host, not "localhost" — that's the service name
    // this container will reach it under in docker-compose (backend and Redis
    // are both containerized; only Postgres stays on the host machine).
    // Override with a real REDIS_URL for local dev without Docker.
    url: process.env.REDIS_URL || "redis://redis:6379",
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || "SmartPlaze <onboarding@resend.dev>",
    // Where website contact-form messages are forwarded.
    supportEmail: process.env.SUPPORT_EMAIL || "support@smartplaze.com",
  },

  otp: {
    length: 6,
    emailVerificationTtlMinutes: parseInt(process.env.OTP_EMAIL_VERIFICATION_TTL_MIN || "10", 10),
    passwordResetTtlMinutes: parseInt(process.env.OTP_PASSWORD_RESET_TTL_MIN || "15", 10),
    maxAttempts: 5,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Must exactly match an "Authorized redirect URI" registered in the Google
    // Cloud Console for this client — Google rejects the callback otherwise.
    redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback",
  },
};
