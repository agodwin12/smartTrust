const crypto = require("crypto");
const { google } = require("../config/env");
const ApiError = require("../utils/ApiError");

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function randomState() {
  return crypto.randomBytes(24).toString("hex");
}

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: google.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: google.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(502, data.error_description || "Google token exchange failed.", "GOOGLE_OAUTH_ERROR");
  }
  return data; // { access_token, id_token, ... }
}

async function getProfile(accessToken) {
  const res = await fetch(USERINFO_URL, {
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(502, "Failed to fetch Google profile.", "GOOGLE_OAUTH_ERROR");
  }
  return data; // { sub, email, email_verified, given_name, family_name, picture, ... }
}

module.exports = { randomState, getAuthUrl, exchangeCodeForTokens, getProfile };
