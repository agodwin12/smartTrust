const Redis = require("ioredis");
const { redis: redisConfig } = require("./env");
const logger = require("./logger");

// Caching must be a pure performance optimization, never a hard dependency —
// if Redis is down or unreachable, every read should just fall through to
// Postgres, not hang or crash the request. That's why:
//   - enableOfflineQueue: false -> commands fail immediately instead of
//     queueing forever while disconnected (queued commands would make a
//     request hang, not fail fast).
//   - maxRetriesPerRequest: 1 -> a single command doesn't retry internally
//     and block the caller; reconnection is handled separately in the
//     background by retryStrategy below.
//   - the "error" listener below is required — an unhandled "error" event on
//     an ioredis client crashes the whole Node process.
const redis = new Redis(redisConfig.url, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  lazyConnect: false,
});

let hasWarned = false;
redis.on("error", (err) => {
  if (!hasWarned) {
    logger.warn({ err: err.message }, "Redis unavailable — caching and the distributed rate limiter are disabled until it reconnects");
    hasWarned = true;
  }
});
redis.on("connect", () => {
  hasWarned = false;
  logger.info("Redis connected");
});

module.exports = redis;
