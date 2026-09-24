const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../services/token.service");
const cacheService = require("../services/cache.service");

const USER_CACHE_TTL_SECONDS = 60;

/**
 * Verifies the access token AND re-checks the user's current status/role on
 * every request (not just at token-issue time), so a Super Admin suspending or
 * demoting someone takes effect immediately instead of waiting out the token.
 *
 * That re-check is a database hit on EVERY authenticated request — at hundreds
 * of concurrent users it's the single hottest query in the app and the fastest
 * way to exhaust the connection pool. So it's cached in Redis for 60s, and every
 * place that changes what's cached (status, role, email verification, Google
 * link) busts the key explicitly — see cacheService.userKey — which keeps the
 * "takes effect immediately" guarantee intact. The cached value never includes
 * the password hash. Redis down = uncached, same as everywhere else.
 */
async function authenticate(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Authentication required.", "TOKEN_MISSING"));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const code = err instanceof jwt.TokenExpiredError ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    return next(new ApiError(401, "Invalid or expired session.", code));
  }

  const user = await cacheService.getOrSet(cacheService.userKey(payload.sub), USER_CACHE_TTL_SECONDS, async () => {
    const row = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!row) return null;
    const { passwordHash, ...safe } = row;
    return safe;
  });

  if (!user || user.status !== "ACTIVE") {
    return next(new ApiError(401, "Account is no longer active.", "ACCOUNT_INACTIVE"));
  }

  req.user = user;
  next();
}

module.exports = authenticate;
