const authenticate = require("./authenticate");

/**
 * Public routes that behave better for signed-in users (the assistant can read their orders).
 * No Authorization header → anonymous. A header that fails verification still 401s, so the
 * frontend's refresh-and-retry kicks in instead of silently downgrading the user.
 */
function optionalAuthenticate(req, res, next) {
  if (!req.get("authorization")) return next();
  return authenticate(req, res, next);
}

module.exports = optionalAuthenticate;
