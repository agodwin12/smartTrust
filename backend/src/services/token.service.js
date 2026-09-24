const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { auth } = require("../config/env");
const { sha256, randomToken } = require("../utils/hash");

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, auth.accessTokenSecret, {
    expiresIn: auth.accessTokenTtl,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, auth.accessTokenSecret);
}

/** Issues a brand-new refresh token (login/register) — no previous token to rotate from. */
async function issueRefreshToken(userId, meta = {}) {
  const raw = randomToken();
  const expiresAt = new Date(Date.now() + auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(raw),
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  return { raw, expiresAt };
}

const REFRESH_ERROR = {
  MISSING: "REFRESH_TOKEN_MISSING",
  INVALID: "REFRESH_TOKEN_INVALID",
  EXPIRED: "REFRESH_TOKEN_EXPIRED",
  REUSED: "REFRESH_TOKEN_REUSED",
};

/**
 * Validates a presented refresh token and rotates it: the old token is marked
 * revoked (and linked to its replacement) and a new one is issued in the same
 * call, so a refresh token is single-use. If a token that was already revoked
 * gets presented again — a replay of a stolen token — the entire token family
 * for that user is revoked, forcing re-login everywhere.
 */
async function rotateRefreshToken(rawToken, meta = {}) {
  const tokenHash = sha256(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) {
    return { error: REFRESH_ERROR.INVALID };
  }

  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { error: REFRESH_ERROR.REUSED };
  }

  if (existing.expiresAt < new Date()) {
    return { error: REFRESH_ERROR.EXPIRED };
  }

  const { raw, expiresAt } = await issueRefreshToken(existing.userId, meta);

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedByTokenHash: sha256(raw) },
  });

  return { user: existing.user, raw, expiresAt };
}

async function revokeRefreshToken(rawToken) {
  const tokenHash = sha256(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

module.exports = {
  REFRESH_ERROR,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
