const ApiError = require("../utils/ApiError");

/** Route guard — use after `authenticate`. authorize("SUPER_ADMIN", "ACCOUNTANT") etc. */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required.", "TOKEN_MISSING"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to do this.", "FORBIDDEN"));
    }
    next();
  };
}

module.exports = authorize;
