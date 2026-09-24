const { auth, isProduction } = require("../config/env");

// Scoped to /api/auth so the refresh token cookie is never sent to unrelated routes.
const COOKIE_PATH = "/api/auth";

function setRefreshCookie(res, rawToken, expiresAt) {
  res.cookie(auth.cookieName, rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain: auth.cookieDomain,
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(auth.cookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain: auth.cookieDomain,
    path: COOKIE_PATH,
  });
}

module.exports = { setRefreshCookie, clearRefreshCookie, COOKIE_PATH };
