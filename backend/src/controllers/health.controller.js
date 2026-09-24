const prisma = require("../config/prisma");
const redis = require("../config/redis");
const { version } = require("../../package.json");

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms).unref())]);

/**
 * Readiness: the database is mandatory, Redis is not (caching and rate limiting fail
 * open) — so a Redis outage reports "degraded" with a 200 while a database outage
 * reports "down" with a 503, which is what a load balancer should key on.
 */
async function getHealth(req, res) {
  const [database, cache] = await Promise.all([
    withTimeout(prisma.$queryRaw`SELECT 1`, 2000)
      .then(() => "ok")
      .catch((err) => `down: ${err.message}`),
    withTimeout(redis.ping(), 1000)
      .then(() => "ok")
      .catch((err) => `down: ${err.message}`),
  ]);

  const dbOk = database === "ok";
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? (cache === "ok" ? "ok" : "degraded") : "down",
    checks: { database, redis: cache },
    uptimeSeconds: Math.round(process.uptime()),
    version,
    timestamp: new Date().toISOString(),
  });
}

/** Liveness: the process answers. Cheap enough to poll every few seconds. */
function getLiveness(req, res) {
  res.json({ status: "ok" });
}

module.exports = { getHealth, getLiveness };
