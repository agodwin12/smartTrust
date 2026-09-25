const { Resend } = require("resend");
const { resend: resendConfig } = require("../config/env");
const ApiError = require("../utils/ApiError");

// Lazy — the Resend SDK throws SYNCHRONOUSLY in its constructor if the key is
// missing/empty, which would crash the entire server at require-time (before
// any route even runs) for as long as RESEND_API_KEY is unset. Constructing it
// only when actually sending means the rest of the app works fine in the
// meantime, and the failure surfaces as a normal catchable error exactly where
// register()/forgotPassword() already expect one and handle it.
let resendClient;
function getClient() {
  if (!resendConfig.apiKey) {
    throw new ApiError(503, "Email sending is not configured yet.", "EMAIL_NOT_CONFIGURED");
  }
  if (!resendClient) resendClient = new Resend(resendConfig.apiKey);
  return resendClient;
}

function otpEmailHtml({ firstName, code, purposeLabel, expiryMinutes }) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1B2A4A; margin-bottom: 4px;">Smart Market</h2>
      <p style="color: #333; font-size: 15px;">Hi ${firstName},</p>
      <p style="color: #333; font-size: 15px;">Your ${purposeLabel} code is:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1B2A4A; background: #F2F2F2; padding: 16px 24px; text-align: center; border-radius: 8px; margin: 16px 0;">
        ${code}
      </div>
      <p style="color: #666; font-size: 13px;">This code expires in ${expiryMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

async function sendOtpEmail({ to, firstName, code, purpose, expiryMinutes }) {
  const purposeLabel = purpose === "PASSWORD_RESET" ? "password reset" : "email verification";
  const subject = purpose === "PASSWORD_RESET" ? "Reset your Smart Market password" : "Verify your Smart Market email";

  return getClient().emails.send({
    from: resendConfig.fromEmail,
    to,
    subject,
    html: otpEmailHtml({ firstName, code, purposeLabel, expiryMinutes }),
  });
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Forwards a website contact-form submission to the support inbox (reply-to = the visitor). */
async function sendContactNotification({ id, name, email, subject, message, locale }) {
  return getClient().emails.send({
    from: resendConfig.fromEmail,
    to: resendConfig.supportEmail,
    replyTo: email,
    subject: `[Contact] ${subject}`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1B2A4A; margin-bottom: 4px;">New contact message</h2>
        <p style="color: #666; font-size: 13px;">#${escapeHtml(id)} · ${escapeHtml(locale)}</p>
        <p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p>
        <p style="white-space: pre-wrap; color: #333; font-size: 15px;">${escapeHtml(message)}</p>
      </div>
    `,
  });
}

/** Tells a seller whether their new store was approved (with the reason when it was not). */
async function sendStoreDecisionEmail({ to, firstName, storeName, approved, reason, dashboardUrl }) {
  const subject = approved ? `Your store "${storeName}" is approved` : `Your store "${storeName}" was not approved`;
  const body = approved
    ? `<p style="color: #333; font-size: 15px;">Good news: your store <strong>${escapeHtml(storeName)}</strong> has been approved. You can now choose a plan and publish your listings.</p>`
    : `<p style="color: #333; font-size: 15px;">Your store <strong>${escapeHtml(storeName)}</strong> was not approved yet.</p>
       ${reason ? `<p style="color: #333; font-size: 15px; background: #F2F2F2; padding: 12px 16px; border-radius: 8px;">${escapeHtml(reason)}</p>` : ""}
       <p style="color: #333; font-size: 15px;">Update your store details and reply to this email or contact support if you have questions.</p>`;
  return getClient().emails.send({
    from: resendConfig.fromEmail,
    to,
    subject,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1B2A4A; margin-bottom: 4px;">Smart Market</h2>
        <p style="color: #333; font-size: 15px;">Hi ${escapeHtml(firstName || "there")},</p>
        ${body}
        <p style="margin-top: 20px;"><a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; background: #F7941D; color: #fff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px;">Open my seller area</a></p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail, sendContactNotification, sendStoreDecisionEmail };
