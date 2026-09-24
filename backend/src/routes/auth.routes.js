const { Router } = require("express");
const controller = require("../controllers/auth.controller");
const authenticate = require("../middlewares/authenticate");
const { authRateLimiter, otpRequestRateLimiter, otpVerifyRateLimiter } = require("../middlewares/rateLimiter");
const { validateBody } = require("../middlewares/validate");
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validators/auth.validators");

const router = Router();

router.post("/register", authRateLimiter, validateBody(registerSchema), controller.register);
router.post("/login", authRateLimiter, validateBody(loginSchema), controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", authenticate, controller.me);

router.post("/verify-email", authenticate, otpVerifyRateLimiter, validateBody(verifyEmailSchema), controller.verifyEmail);
router.post("/resend-verification", authenticate, otpRequestRateLimiter, controller.resendVerification);

router.post("/forgot-password", otpRequestRateLimiter, validateBody(forgotPasswordSchema), controller.forgotPassword);
router.post("/reset-password", otpVerifyRateLimiter, validateBody(resetPasswordSchema), controller.resetPassword);

// Google OAuth — browser-redirect flow, not a JSON API call. GET because it's
// meant to be a link/window.location target, not something a frontend fetch()es.
router.get("/google", controller.googleRedirect);
router.get("/google/callback", controller.googleCallback);

module.exports = router;
