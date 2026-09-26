const { port, auth, jobs: jobsConfig } = require("./config/env");
// Sentry must initialise before the app (and its http/pg/ioredis instrumentation) loads.
const sentry = require("./config/sentry");
const logger = require("./config/logger");

// Fail fast rather than silently signing/verifying JWTs with `undefined` as the secret.
if (!auth.accessTokenSecret) {
  logger.fatal("Missing JWT_ACCESS_SECRET in the environment. Refusing to start.");
  process.exit(1);
}

const app = require("./app");
const prisma = require("./config/prisma");
const redis = require("./config/redis");
const jobs = require("./jobs");

// HOST lets a host-networked container bind to 127.0.0.1 only (reverse proxy in front).
const host = process.env.HOST || "0.0.0.0";
const server = app.listen(port, host, () => {
  logger.info({ port }, `SmartPlaze API listening on http://localhost:${port}`);
  if (jobsConfig.enabled) jobs.start();
  else logger.info("Background jobs disabled (JOBS_ENABLED=false)");
});

// Behind a load balancer / reverse proxy, Node's default 5s keep-alive is
// shorter than the proxy's idle timeout (typically 60s), so the proxy can reuse
// a connection Node has just closed and surface it as a random 502. Keep ours
// longer than the proxy's.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// Node ≥15 turns an unhandled promise rejection into a process crash. Anything
// fire-and-forget (audit writes, cache invalidation) is already caught at its
// source, but this is the backstop so one stray rejection can't take down every
// in-flight request for every user at once.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
  sentry.captureException(reason, { source: "unhandledRejection" });
});

// An uncaught exception means state may be corrupt — don't limp on. Log it,
// stop taking new connections, let in-flight requests finish, then exit so the
// orchestrator (Docker restart policy) brings up a clean process.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception, shutting down");
  sentry.captureException(err, { source: "uncaughtException" });
  shutdown(1);
});

// Docker `stop` / a deploy sends SIGTERM. Without this, in-flight requests are
// killed mid-response and open DB/Redis connections are just dropped.
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

let shuttingDown = false;
function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Shutting down gracefully");
  jobs.stop();

  // Stop accepting new connections; existing ones finish naturally.
  server.close(async () => {
    try {
      await prisma.$disconnect();
      await redis.quit().catch(() => {});
    } finally {
      process.exit(exitCode);
    }
  });

  // Hard deadline so a hung request can't block the restart forever.
  setTimeout(() => process.exit(exitCode), 10_000).unref();
}
