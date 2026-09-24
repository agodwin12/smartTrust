const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { auth } = require("../config/env");
const ApiError = require("../utils/ApiError");
const { signAccessToken, issueRefreshToken, revokeAllUserTokens } = require("./token.service");
const otpService = require("./otp.service");
const cacheService = require("./cache.service");
const logger = require("../config/logger");

function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function register({ email, password, firstName, lastName, phone }, meta) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.status !== "GUEST") {
    throw new ApiError(409, "An account with this email already exists.", "EMAIL_IN_USE");
  }

  const passwordHash = await bcrypt.hash(password, auth.bcryptSaltRounds);

  // A guest who ordered with this email before keeps their orders: the row is upgraded
  // into a real account instead of being duplicated.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, firstName, lastName, status: "ACTIVE", emailVerifiedAt: null, ...(phone && phone !== existing.phone ? { phone } : {}) },
      })
    : await prisma.user.create({
        data: { email, passwordHash, firstName, lastName, phone },
      });

  // Registration succeeds either way — a slow/broken email provider shouldn't
  // block account creation. The user can always hit /resend-verification.
  try {
    await otpService.generateAndSend(user, "EMAIL_VERIFICATION");
  } catch (err) {
    logger.warn({ err: err.message, email: user.email }, "Failed to send verification email");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, meta);

  return { user: toSafeUser(user), accessToken, refreshToken };
}

async function login({ email, password }, meta) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same generic message whether the email doesn't exist, the password is wrong,
  // or this is a Google-only account with no local password at all — never
  // reveal which one it was (avoids account enumeration).
  const invalid = () => new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");

  if (!user || !user.passwordHash) throw invalid();

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) throw invalid();

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "This account is not active. Contact support.", "ACCOUNT_NOT_ACTIVE");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, meta);

  return { user: toSafeUser(user), accessToken, refreshToken };
}

async function verifyEmail(userId, code) {
  await otpService.verify(userId, "EMAIL_VERIFICATION", code);
  const user = await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  // requireVerifiedEmail reads emailVerifiedAt off the cached req.user — bust it
  // or the user is told "verify your email first" for up to a minute after doing so.
  await cacheService.invalidateKey(cacheService.userKey(userId));
  return toSafeUser(user);
}

async function resendVerification(user) {
  if (user.emailVerifiedAt) {
    throw new ApiError(409, "This email is already verified.", "EMAIL_ALREADY_VERIFIED");
  }
  await otpService.generateAndSend(user, "EMAIL_VERIFICATION");
}

/** Always succeeds from the caller's perspective — never reveals whether the email is registered. */
async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return; // no account, or Google-only — nothing to email a reset code to

  try {
    await otpService.generateAndSend(user, "PASSWORD_RESET");
  } catch (err) {
    logger.warn({ err: err.message, email: user.email }, "Failed to send password reset email");
  }
}

async function resetPassword({ email, code, newPassword }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    // Same OTP_NOT_FOUND-shaped error as a wrong/missing code — don't leak account existence here either.
    throw new ApiError(400, "No active code found. Request a new one.", "OTP_NOT_FOUND");
  }

  await otpService.verify(user.id, "PASSWORD_RESET", code);

  const passwordHash = await bcrypt.hash(newPassword, auth.bcryptSaltRounds);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Same principle as the authenticated change-password flow — a reset should
  // kill every existing session, not just leave old refresh tokens usable.
  await revokeAllUserTokens(user.id);
}

/**
 * Google sign-in: link-or-create, never duplicate. Three cases:
 *  1. googleId already linked to a user -> that's them, log in.
 *  2. No googleId match, but the email matches an existing (password-based)
 *     account -> link this Google identity to it rather than creating a
 *     second account for the same person.
 *  3. Neither matches -> brand new account, no local password at all.
 * Google has already verified the email, so emailVerifiedAt is set immediately
 * either way (case 2 also backfills it if that account hadn't verified yet).
 */
async function loginOrRegisterWithGoogle(profile, meta) {
  if (!profile.email_verified) {
    throw new ApiError(403, "Your Google account's email is not verified.", "GOOGLE_EMAIL_NOT_VERIFIED");
  }

  let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId: profile.sub, emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date() },
      });
      await cacheService.invalidateKey(cacheService.userKey(user.id));
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          googleId: profile.sub,
          passwordHash: null,
          firstName: profile.given_name || profile.name || "Google",
          lastName: profile.family_name || "User",
          emailVerifiedAt: new Date(),
        },
      });
    }
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "This account is not active. Contact support.", "ACCOUNT_NOT_ACTIVE");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, meta);

  return { user: toSafeUser(user), accessToken, refreshToken };
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  loginOrRegisterWithGoogle,
  toSafeUser,
};
