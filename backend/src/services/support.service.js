const prisma = require("../config/prisma");
const emailService = require("./email.service");
const logger = require("../config/logger");

/**
 * Stores the message first (the durable part), then tries to notify the support
 * inbox by email. Email is fail-open like everywhere else: Resend being
 * unconfigured or down must never turn a valid contact form into a 5xx.
 */
async function submitContact({ name, email, subject, message, locale = "en" }, ipAddress) {
  const saved = await prisma.contactMessage.create({
    data: { name, email, subject, message, locale, ipAddress },
  });

  emailService
    .sendContactNotification({ name, email, subject, message, locale, id: saved.id })
    .catch((error) => logger.warn({ err: error.message }, "[support] contact notification email failed"));

  return saved;
}

/** Idempotent: re-subscribing an existing (or unsubscribed) address just re-activates it. */
async function subscribeNewsletter({ email, locale = "en" }) {
  const normalized = email.toLowerCase();
  return prisma.newsletterSubscriber.upsert({
    where: { email: normalized },
    create: { email: normalized, locale },
    update: { locale, unsubscribedAt: null },
  });
}

async function listMessages({ page = 1, pageSize = 20, unhandledOnly = false } = {}) {
  const where = unhandledOnly ? { handledAt: null } : {};
  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.contactMessage.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function markHandled(id, handled = true) {
  return prisma.contactMessage.update({ where: { id }, data: { handledAt: handled ? new Date() : null } });
}

async function listSubscribers({ page = 1, pageSize = 50 } = {}) {
  const where = { unsubscribedAt: null };
  const [items, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.newsletterSubscriber.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

module.exports = { submitContact, subscribeNewsletter, listMessages, markHandled, listSubscribers };
