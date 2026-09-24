const redis = require("../config/redis");
const logger = require("../config/logger");

/**
 * Cache-aside helper: returns the cached value for `key` if present, otherwise
 * calls `fetchFn`, caches its result for `ttlSeconds`, and returns it. Any
 * Redis failure (down, timeout, whatever) is swallowed and treated as a cache
 * miss — the request still succeeds by going straight to `fetchFn`, just
 * without the speedup. Caching a slow path is fine; caching a broken path
 * that takes the whole API down with it is not.
 */
// Single-flight: when a hot key expires under load, the first request recomputes it and
// every concurrent request for the same key waits for that one result instead of each
// hitting Postgres (the "thundering herd" that exhausts the connection pool).
const inFlight = new Map();

async function getOrSet(key, ttlSeconds, fetchFn) {
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = getOrSetUncoalesced(key, ttlSeconds, fetchFn).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function getOrSetUncoalesced(key, ttlSeconds, fetchFn) {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      logger.debug({ key, result: "hit" }, "cache");
      return JSON.parse(cached);
    }
    logger.debug({ key, result: "miss" }, "cache");
  } catch (err) {
    logger.warn({ key, err: err.message }, "Cache read failed, falling through to the database");
  }

  const value = await fetchFn();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ key, err: err.message }, "Cache write failed");
  }

  return value;
}

/** Deletes one exact key — same fail-open contract as everything else here. */
async function invalidateKey(key) {
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn({ key, err: err.message }, "Cache invalidation failed");
  }
}

/** Deletes every key matching a prefix (e.g. "categories:list:*") — used to bust a group of cache entries on write. */
async function invalidatePrefix(prefix) {
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    logger.warn({ prefix, err: err.message }, "Cache prefix invalidation failed");
  }
}

/** The authenticated-user cache key (see middlewares/authenticate.js) — anything that changes a user's role/status/verification must bust it. */
const userKey = (userId) => `auth:user:${userId}`;

module.exports = { getOrSet, invalidateKey, invalidatePrefix, userKey };
