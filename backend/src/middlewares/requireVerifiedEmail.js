const ApiError = require("../utils/ApiError");

// Gates the actions that carry real weight (opening a store, moving money) on the
// sign-up OTP having been confirmed — browsing and profile edits stay open to
// unverified accounts. Google sign-ups are verified on creation, so they pass.
function requireVerifiedEmail(req, res, next) {
  if (!req.user?.emailVerifiedAt) {
    return next(new ApiError(403, "Please verify your email address first.", "EMAIL_NOT_VERIFIED"));
  }
  next();
}

module.exports = requireVerifiedEmail;
