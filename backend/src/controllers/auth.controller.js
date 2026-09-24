const authService = require("../services/auth.service");
const tokenService = require("../services/token.service");
const googleOAuthService = require("../services/googleOAuth.service");
const userService = require("../services/user.service");
const audit = require("../services/audit.service");
const ApiError = require("../utils/ApiError");
const { setRefreshCookie, clearRefreshCookie } = require("../utils/cookies");
const { auth: authConfig, isProduction, frontendUrl } = require("../config/env");
const logger = require("../config/logger");

const OAUTH_STATE_COOKIE = "oauth_state";

function requestMeta(req) {
  return { userAgent: req.get("user-agent"), ipAddress: req.ip };
}

async function register(req, res) {
  const { user, accessToken, refreshToken } = await authService.register(req.body, requestMeta(req));
  setRefreshCookie(res, refreshToken.raw, refreshToken.expiresAt);
  audit.record(req, { action: "USER_REGISTERED", entityType: "User", entityId: user.id, actorId: user.id, actorRole: user.role });
  // Same shape as GET /users/me (store relation included) so the client never has to re-fetch after sign-in.
  res.status(201).json({ user: await userService.getById(user.id), accessToken });
}

async function login(req, res) {
  let result;
  try {
    result = await authService.login(req.body, requestMeta(req));
  } catch (err) {
    // Failed sign-ins are part of the trail too — "who tried to get into which
    // account, from where" is exactly what an admin wants after an incident.
    if (err.code === "INVALID_CREDENTIALS" || err.code === "ACCOUNT_NOT_ACTIVE") {
      audit.record(req, { action: "LOGIN_FAILED", metadata: { email: req.body.email, reason: err.code } });
    }
    throw err;
  }
  const { user, accessToken, refreshToken } = result;
  setRefreshCookie(res, refreshToken.raw, refreshToken.expiresAt);
  audit.record(req, { action: "LOGIN", entityType: "User", entityId: user.id, actorId: user.id, actorRole: user.role });
  res.json({ user: await userService.getById(user.id), accessToken });
}

async function refresh(req, res) {
  const rawToken = req.cookies?.[authConfig.cookieName];

  if (!rawToken) {
    throw new ApiError(401, "No refresh token provided.", tokenService.REFRESH_ERROR.MISSING);
  }

  const result = await tokenService.rotateRefreshToken(rawToken, requestMeta(req));

  if (result.error) {
    clearRefreshCookie(res);
    throw new ApiError(401, "Session expired. Please sign in again.", result.error);
  }

  const accessToken = tokenService.signAccessToken(result.user);
  setRefreshCookie(res, result.raw, result.expiresAt);
  res.json({ accessToken, user: await userService.getById(result.user.id) });
}

async function logout(req, res) {
  const rawToken = req.cookies?.[authConfig.cookieName];
  if (rawToken) {
    await tokenService.revokeRefreshToken(rawToken);
  }
  clearRefreshCookie(res);
  audit.record(req, { action: "LOGOUT" });
  res.status(204).send();
}

async function me(req, res) {
  res.json({ user: req.user });
}

async function verifyEmail(req, res) {
  const user = await authService.verifyEmail(req.user.id, req.body.code);
  audit.record(req, { action: "EMAIL_VERIFIED", entityType: "User", entityId: user.id });
  res.json({ user });
}

async function resendVerification(req, res) {
  await authService.resendVerification(req.user);
  res.status(204).send();
}

async function forgotPassword(req, res) {
  await authService.forgotPassword(req.body.email);
  // Always the same response — this endpoint never reveals whether the email is registered.
  res.json({ message: "If that email is registered, a reset code has been sent." });
}

async function resetPassword(req, res) {
  await authService.resetPassword(req.body);
  audit.record(req, { action: "PASSWORD_RESET", metadata: { email: req.body.email } });
  res.status(204).send();
}

async function googleRedirect(req, res) {
  const state = googleOAuthService.randomState();

  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60 * 1000,
  });

  res.redirect(googleOAuthService.getAuthUrl(state));
}

async function googleCallback(req, res) {
  const { code, state } = req.query;
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/auth/google" });

  if (!code || !state || !cookieState || state !== cookieState) {
    return res.redirect(`${frontendUrl}/auth/callback?error=oauth_state_mismatch`);
  }

  try {
    const tokens = await googleOAuthService.exchangeCodeForTokens(code);
    const profile = await googleOAuthService.getProfile(tokens.access_token);
    const { user, accessToken, refreshToken } = await authService.loginOrRegisterWithGoogle(profile, requestMeta(req));

    setRefreshCookie(res, refreshToken.raw, refreshToken.expiresAt);
    audit.record(req, { action: "LOGIN_GOOGLE", entityType: "User", entityId: user.id, actorId: user.id, actorRole: user.role });
    // The fragment (#...), not a query string — fragments are never sent to any
    // server (not ours on the next request, not analytics, not a Referer header),
    // unlike a query param, which is exactly why the classic OAuth implicit flow
    // used it for this same handoff.
    res.redirect(`${frontendUrl}/auth/callback#accessToken=${encodeURIComponent(accessToken)}`);
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    res.redirect(`${frontendUrl}/auth/callback?error=oauth_failed`);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  googleRedirect,
  googleCallback,
};
