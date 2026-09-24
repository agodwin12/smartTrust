const crypto = require("crypto");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { sha256 } = require("../utils/hash");
const { otp: otpConfig } = require("../config/env");
const emailService = require("./email.service");

function generateCode() {
  // 6 digits, zero-padded — crypto.randomInt is uniform (not Math.random()'s bias).
  return crypto.randomInt(0, 10 ** otpConfig.length).toString().padStart(otpConfig.length, "0");
}

function ttlMinutesFor(purpose) {
  return purpose === "PASSWORD_RESET" ? otpConfig.passwordResetTtlMinutes : otpConfig.emailVerificationTtlMinutes;
}

/**
 * Generates a fresh OTP, invalidates any still-usable one of the same purpose for
 * this user (never more than one live code at a time — avoids confusion about
 * which code is current), and emails it. Does NOT swallow an email-send failure —
 * it throws, on purpose. Whether that should fail the caller's whole request is a
 * per-endpoint decision (e.g. registration succeeds either way; an explicit
 * "resend" request should probably surface the failure) — made at each call site,
 * not hidden in here.
 */
async function generateAndSend(user, purpose) {
  const code = generateCode();
  const expiryMinutes = ttlMinutesFor(purpose);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() }, // invalidated, not "used" — but same effect: can't be verified again
    }),
    prisma.otpCode.create({
      data: { userId: user.id, purpose, codeHash: sha256(code), expiresAt },
    }),
  ]);

  await emailService.sendOtpEmail({
    to: user.email,
    firstName: user.firstName,
    code,
    purpose,
    expiryMinutes,
  });
}

/**
 * Verifies a submitted code: must be the current (non-consumed, non-expired) one
 * for that user+purpose, under the attempt cap. A wrong guess counts against the
 * cap immediately (before checking anything else about it) so a script can't
 * pointlessly retry a code that's already expired to avoid the counter.
 */
async function verify(userId, purpose, submittedCode) {
  const record = await prisma.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw new ApiError(400, "No active code found. Request a new one.", "OTP_NOT_FOUND");
  }
  if (record.attempts >= otpConfig.maxAttempts) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new code.", "OTP_LOCKED");
  }
  if (record.expiresAt < new Date()) {
    throw new ApiError(400, "This code has expired. Request a new one.", "OTP_EXPIRED");
  }

  const matches = sha256(submittedCode) === record.codeHash;

  if (!matches) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(400, "Incorrect code.", "OTP_INCORRECT");
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
}

module.exports = { generateAndSend, verify };
