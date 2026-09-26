const { z } = require("zod");
const prisma = require("../config/prisma");
const gemini = require("./gemini.service");
const logger = require("../config/logger");

/**
 * Super Admin back-office assistant (Gemini). Answers questions like "what happened today?",
 * "orders from Smart Trust still waiting for delivery", "disputes opened this month" or
 * "top stores last week" by calling the read-only tools below. Nothing here writes data.
 * Access is restricted to SUPER_ADMIN in admin.routes.js.
 */

const TZ_OFFSET_MS = 60 * 60 * 1000; // Africa/Douala = UTC+1, no daylight saving
const MAX_ROWS = 25;
const ORDER_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "PAID", "COMPLETED", "CANCELLED", "DISPUTED", "REFUNDED"];

const money = (value) => `${Math.round(Number(value ?? 0)).toLocaleString("en-US")} FCFA`;
const shortId = (id) => id.slice(-8).toUpperCase();
const doualaDate = (date) => new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);

/* ------------------------------------------------------------------------- */
/* Dates: "2026-09-26" = that day in Douala; "to" is inclusive                 */
/* ------------------------------------------------------------------------- */

function dayStart(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Date.parse(`${value}T00:00:00Z`) - TZ_OFFSET_MS);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  return parsed;
}

function range({ from, to } = {}, { defaultToday = false } = {}) {
  const today = doualaDate(new Date());
  const start = from ? dayStart(from) : defaultToday ? dayStart(today) : null;
  let end = null;
  if (to) end = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(dayStart(to).getTime() + 24 * 60 * 60 * 1000) : dayStart(to);
  else if (defaultToday || from) end = new Date();
  const where = start || end ? { ...(start && { gte: start }), ...(end && { lt: end }) } : undefined;
  return { where, label: { from: start ? doualaDate(start) : "beginning", to: end ? doualaDate(new Date(end.getTime() - 1)) : "now" } };
}

const dates = { from: z.string().trim().max(40).optional(), to: z.string().trim().max(40).optional() };
const limit = z.coerce.number().int().min(1).max(MAX_ROWS).default(10);

/* ------------------------------------------------------------------------- */
/* Tools                                                                      */
/* ------------------------------------------------------------------------- */

const DATE_PROPS = {
  from: { type: "string", description: "Start date YYYY-MM-DD (Douala time), inclusive." },
  to: { type: "string", description: "End date YYYY-MM-DD (Douala time), inclusive." },
};
const LIMIT_PROP = { type: "integer", minimum: 1, maximum: MAX_ROWS, description: "Max rows (default 10)." };

const TOOLS = [
  {
    name: "platform_summary",
    description: "Overview of a period: orders by status with amounts, payment methods, new customers and guests, new stores, listings created, disputes, refunds, withdrawals and subscription income, plus the current escrow/pending snapshot. Defaults to today.",
    input_schema: { type: "object", properties: { ...DATE_PROPS } },
  },
  {
    name: "search_orders",
    description: "Find orders with any combination of filters. Returns the total count and value plus the newest matching orders.",
    input_schema: {
      type: "object",
      properties: {
        ...DATE_PROPS,
        status: { type: "string", enum: ORDER_STATUSES, description: "Order status." },
        paymentMethod: { type: "string", enum: ["MOBILE_MONEY", "CASH_ON_DELIVERY"] },
        store: { type: "string", description: "Store name or slug (partial match)." },
        buyer: { type: "string", description: "Buyer email, first or last name (partial match)." },
        product: { type: "string", description: "Words from the listing title." },
        reference: { type: "string", description: "Cart order reference, e.g. SM-7F3K2Q." },
        awaitingDelivery: { type: "boolean", description: "Only orders paid or confirmed that the seller has not delivered yet." },
        minAmount: { type: "number", description: "Minimum order total in FCFA." },
        maxAmount: { type: "number", description: "Maximum order total in FCFA." },
        limit: LIMIT_PROP,
      },
    },
  },
  {
    name: "get_order",
    description: "Full detail and timeline of one order, by its id, the 8-character short id shown in the back office, or a cart reference SM-XXXXXX (returns every line of that cart).",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_disputes",
    description: "Disputes with their order, reason, status and resolution.",
    input_schema: { type: "object", properties: { ...DATE_PROPS, status: { type: "string", enum: ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"] }, limit: LIMIT_PROP } },
  },
  {
    name: "list_stores",
    description: "Stores with owner, status (PENDING = awaiting approval), listings, wallet balance and review note.",
    input_schema: { type: "object", properties: { ...DATE_PROPS, status: { type: "string", enum: ["PENDING", "ACTIVE", "SUSPENDED"] }, search: { type: "string", description: "Store name (partial)." }, limit: LIMIT_PROP } },
  },
  {
    name: "top_stores",
    description: "Stores ranked by order value in a period (paid, cash-confirmed and completed orders). Defaults to the last 30 days.",
    input_schema: { type: "object", properties: { ...DATE_PROPS, limit: LIMIT_PROP } },
  },
  {
    name: "list_payments",
    description: "Mobile Money payments (orders, cart orders and subscriptions) with status and amount.",
    input_schema: { type: "object", properties: { ...DATE_PROPS, status: { type: "string", enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"] }, limit: LIMIT_PROP } },
  },
  {
    name: "list_withdrawals",
    description: "Seller withdrawals to Mobile Money with status and amount.",
    input_schema: { type: "object", properties: { ...DATE_PROPS, status: { type: "string", enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"] }, limit: LIMIT_PROP } },
  },
  {
    name: "recent_activity",
    description: "Audit log: who did what and when (store approvals, escrow releases, refunds, status changes, logins to staff actions...). Filter by action name (e.g. STORE_APPROVED, ESCROW_RELEASED), actor email or entity type.",
    input_schema: { type: "object", properties: { ...DATE_PROPS, action: { type: "string" }, actor: { type: "string", description: "Actor email (partial)." }, entityType: { type: "string", description: "e.g. Order, Store, User, Dispute." }, limit: LIMIT_PROP } },
  },
];

const inputs = {
  platform_summary: z.object({ ...dates }),
  search_orders: z.object({
    ...dates,
    status: z.enum(ORDER_STATUSES).optional(),
    paymentMethod: z.enum(["MOBILE_MONEY", "CASH_ON_DELIVERY"]).optional(),
    store: z.string().trim().max(80).optional(),
    buyer: z.string().trim().max(120).optional(),
    product: z.string().trim().max(120).optional(),
    reference: z.string().trim().max(20).optional(),
    awaitingDelivery: z.boolean().optional(),
    minAmount: z.coerce.number().nonnegative().optional(),
    maxAmount: z.coerce.number().positive().optional(),
    limit,
  }),
  get_order: z.object({ id: z.string().trim().min(4).max(40) }),
  list_disputes: z.object({ ...dates, status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]).optional(), limit }),
  list_stores: z.object({ ...dates, status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional(), search: z.string().trim().max(80).optional(), limit }),
  top_stores: z.object({ ...dates, limit }),
  list_payments: z.object({ ...dates, status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"]).optional(), limit }),
  list_withdrawals: z.object({ ...dates, status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]).optional(), limit }),
  recent_activity: z.object({ ...dates, action: z.string().trim().max(60).optional(), actor: z.string().trim().max(120).optional(), entityType: z.string().trim().max(40).optional(), limit }),
};

const orderInclude = {
  buyer: { select: { email: true, firstName: true, lastName: true, phone: true, status: true } },
  advertisement: { select: { title: true, store: { select: { name: true, slug: true } } } },
  group: { select: { reference: true } },
  payment: { select: { status: true, amount: true } },
  escrow: { select: { status: true, amount: true } },
};

const orderRow = (o) => ({
  id: o.id,
  shortId: shortId(o.id),
  reference: o.group?.reference ?? null,
  item: o.advertisement?.title,
  store: o.advertisement?.store?.name,
  buyer: o.buyer ? `${o.buyer.firstName} ${o.buyer.lastName}`.trim() + ` <${o.buyer.email}>${o.buyer.status === "GUEST" ? " (guest)" : ""}` : null,
  quantity: o.quantity,
  total: money(o.totalAmount),
  status: o.status,
  paymentMethod: o.paymentMethod,
  placedAt: o.createdAt,
  sellerDelivered: Boolean(o.sellerConfirmedAt),
  buyerConfirmed: Boolean(o.buyerConfirmedAt),
  link: `/admin/orders/${o.id}`,
});

const byStatus = (rows, sumField) =>
  Object.fromEntries(rows.map((r) => [r.status, { count: r._count._all, ...(sumField && { amount: money(r._sum?.[sumField]) }) }]));

const tools = {
  async platform_summary(args) {
    const { where: when, label } = range(args, { defaultToday: true });
    const created = when ? { createdAt: when } : {};
    const [orders, methods, customers, guests, stores, listings, disputesOpened, disputesResolved, refunds, withdrawals, subscriptionIncome, carts, escrow, pendingStores, openDisputes, awaitingDelivery] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where: created, _count: { _all: true }, _sum: { totalAmount: true } }),
      prisma.order.groupBy({ by: ["paymentMethod"], where: created, _count: { _all: true }, _sum: { totalAmount: true } }),
      prisma.user.count({ where: { ...created, role: "CUSTOMER", status: { not: "GUEST" } } }),
      prisma.user.count({ where: { ...created, status: "GUEST" } }),
      prisma.store.groupBy({ by: ["status"], where: created, _count: { _all: true } }),
      prisma.advertisement.count({ where: created }),
      prisma.dispute.count({ where: created }),
      prisma.dispute.count({ where: when ? { resolvedAt: when } : { resolvedAt: { not: null } } }),
      prisma.refund.groupBy({ by: ["status"], where: created, _count: { _all: true }, _sum: { amount: true } }),
      prisma.withdrawal.groupBy({ by: ["status"], where: created, _count: { _all: true }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { ...created, subscriptionId: { not: null }, status: "COMPLETED" }, _count: { _all: true }, _sum: { amount: true } }),
      prisma.checkoutGroup.count({ where: created }),
      prisma.escrowTransaction.aggregate({ where: { status: "HELD" }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.store.count({ where: { status: "PENDING" } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
      prisma.order.count({ where: { status: { in: ["PAID", "CONFIRMED"] }, sellerConfirmedAt: null } }),
    ]);
    const totalOrders = orders.reduce((n, r) => n + r._count._all, 0);
    const liveValue = orders.filter((r) => !["CANCELLED", "PENDING_PAYMENT", "REFUNDED"].includes(r.status)).reduce((n, r) => n + Number(r._sum.totalAmount ?? 0), 0);
    return {
      period: label,
      orders: { total: totalOrders, valueExcludingCancelledUnpaidRefunded: money(liveValue), byStatus: byStatus(orders, "totalAmount"), cartCheckouts: carts },
      paymentMethods: Object.fromEntries(methods.map((m) => [m.paymentMethod, { count: m._count._all, amount: money(m._sum.totalAmount) }])),
      newCustomers: customers,
      guestBuyers: guests,
      newStores: byStatus(stores),
      listingsCreated: listings,
      disputes: { opened: disputesOpened, resolved: disputesResolved },
      refunds: byStatus(refunds, "amount"),
      withdrawals: byStatus(withdrawals, "amount"),
      subscriptionIncome: { count: subscriptionIncome._count._all, amount: money(subscriptionIncome._sum.amount) },
      now: { escrowHeld: money(escrow._sum.amount), escrowOrders: escrow._count._all, storesAwaitingApproval: pendingStores, openDisputes, ordersAwaitingDelivery: awaitingDelivery },
    };
  },

  async search_orders(args) {
    const { where: when, label } = range(args);
    const and = [];
    if (when) and.push({ createdAt: when });
    if (args.status) and.push({ status: args.status });
    if (args.paymentMethod) and.push({ paymentMethod: args.paymentMethod });
    if (args.store) and.push({ advertisement: { store: { OR: [{ name: { contains: args.store, mode: "insensitive" } }, { slug: { contains: args.store.toLowerCase() } }] } } });
    if (args.buyer) and.push({ buyer: { OR: ["email", "firstName", "lastName"].map((field) => ({ [field]: { contains: args.buyer, mode: "insensitive" } })) } });
    if (args.product) and.push({ advertisement: { title: { contains: args.product, mode: "insensitive" } } });
    if (args.reference) and.push({ group: { reference: args.reference.toUpperCase() } });
    if (args.awaitingDelivery) and.push({ status: { in: ["PAID", "CONFIRMED"] }, sellerConfirmedAt: null });
    if (args.minAmount !== undefined || args.maxAmount !== undefined) and.push({ totalAmount: { ...(args.minAmount !== undefined && { gte: args.minAmount }), ...(args.maxAmount !== undefined && { lte: args.maxAmount }) } });
    const where = and.length ? { AND: and } : {};
    const [items, agg] = await Promise.all([
      prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: "desc" }, take: args.limit }),
      prisma.order.aggregate({ where, _count: { _all: true }, _sum: { totalAmount: true } }),
    ]);
    return { period: label, total: agg._count._all, totalValue: money(agg._sum.totalAmount), shown: items.length, orders: items.map(orderRow), _orders: items };
  },

  async get_order({ id }) {
    const raw = id.trim();
    let orders;
    if (/^SM-/i.test(raw)) {
      orders = await prisma.order.findMany({ where: { group: { reference: raw.toUpperCase() } }, include: { ...orderInclude, disputes: true, refund: true } });
    } else {
      const one = await prisma.order.findFirst({
        where: raw.length <= 10 ? { id: { endsWith: raw.toLowerCase() } } : { id: raw },
        include: { ...orderInclude, disputes: true, refund: true },
      });
      orders = one ? [one] : [];
    }
    if (orders.length === 0) return { error: `No order matches "${raw}".` };
    return {
      orders: orders.map((o) => ({
        ...orderRow(o),
        deliveryAddress: o.deliveryAddress ?? null,
        timeline: {
          placedAt: o.createdAt,
          payment: o.payment ? `${o.payment.status} ${money(o.payment.amount)}` : o.paymentMethod === "CASH_ON_DELIVERY" ? "cash at handover" : "none yet",
          escrow: o.escrow ? `${o.escrow.status} ${money(o.escrow.amount)}` : null,
          sellerConfirmedAt: o.sellerConfirmedAt,
          buyerConfirmedAt: o.buyerConfirmedAt,
          cancelled: o.cancelledAt ? { at: o.cancelledAt, by: o.cancelledBy, reason: o.cancelReason } : null,
        },
        disputes: o.disputes.map((d) => ({ status: d.status, reason: d.reason, resolution: d.resolution, openedAt: d.createdAt, resolvedAt: d.resolvedAt })),
        refund: o.refund ? { status: o.refund.status, amount: money(o.refund.amount), failureReason: o.refund.failureReason } : null,
      })),
      _orders: orders,
    };
  },

  async list_disputes(args) {
    const { where: when, label } = range(args);
    const where = { ...(when && { createdAt: when }), ...(args.status && { status: args.status }) };
    const [items, total] = await Promise.all([
      prisma.dispute.findMany({ where, orderBy: { createdAt: "desc" }, take: args.limit, include: { raisedBy: { select: { email: true } }, order: { include: orderInclude } } }),
      prisma.dispute.count({ where }),
    ]);
    return {
      period: label,
      total,
      disputes: items.map((d) => ({ status: d.status, reason: d.reason, resolution: d.resolution, raisedBy: d.raisedBy?.email, openedAt: d.createdAt, resolvedAt: d.resolvedAt, order: orderRow(d.order) })),
      _orders: items.map((d) => d.order),
    };
  },

  async list_stores(args) {
    const { where: when, label } = range(args);
    const where = { ...(when && { createdAt: when }), ...(args.status && { status: args.status }), ...(args.search && { name: { contains: args.search, mode: "insensitive" } }) };
    const [items, total] = await Promise.all([
      prisma.store.findMany({ where, orderBy: { createdAt: "desc" }, take: args.limit, include: { owner: { select: { email: true, firstName: true, lastName: true } }, wallet: { select: { balance: true } }, _count: { select: { advertisements: true } } } }),
      prisma.store.count({ where }),
    ]);
    return {
      period: label,
      total,
      stores: items.map((s) => ({ name: s.name, slug: s.slug, status: s.status, location: s.location, owner: `${s.owner.firstName} ${s.owner.lastName} <${s.owner.email}>`, listings: s._count.advertisements, walletBalance: money(s.wallet?.balance), reviewNote: s.reviewNote, createdAt: s.createdAt, link: "/admin/stores" })),
    };
  },

  async top_stores(args) {
    const { where: when, label } = range(args.from || args.to ? args : { from: doualaDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)) });
    const from = when?.gte ?? new Date(0);
    const to = when?.lt ?? new Date();
    const rows = await prisma.$queryRaw`
      SELECT s.name, s.slug, COUNT(o.id)::int AS orders, COALESCE(SUM(o."totalAmount"), 0) AS value
      FROM orders o
      JOIN advertisements a ON a.id = o."advertisementId"
      JOIN stores s ON s.id = a."storeId"
      WHERE o."createdAt" >= ${from} AND o."createdAt" < ${to}
        AND o.status IN ('PAID', 'CONFIRMED', 'COMPLETED')
      GROUP BY s.id, s.name, s.slug
      ORDER BY value DESC
      LIMIT ${args.limit}`;
    return { period: label, stores: rows.map((r, i) => ({ rank: i + 1, name: r.name, slug: r.slug, orders: r.orders, value: money(r.value) })) };
  },

  async list_payments(args) {
    const { where: when, label } = range(args);
    const where = { ...(when && { createdAt: when }), ...(args.status && { status: args.status }) };
    const [items, agg] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: args.limit,
        include: { order: { select: { id: true, advertisement: { select: { title: true } } } }, group: { select: { reference: true } }, subscription: { select: { plan: { select: { name: true } }, store: { select: { name: true } } } } },
      }),
      prisma.payment.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
    ]);
    return {
      period: label,
      total: agg._count._all,
      totalAmount: money(agg._sum.amount),
      payments: items.map((p) => ({
        status: p.status,
        amount: money(p.amount),
        operator: p.operator,
        for: p.order ? `order ${shortId(p.order.id)} (${p.order.advertisement?.title})` : p.group ? `cart ${p.group.reference}` : p.subscription ? `plan ${p.subscription.plan?.name} for ${p.subscription.store?.name}` : "unknown",
        failureReason: p.failureReason,
        createdAt: p.createdAt,
      })),
    };
  },

  async list_withdrawals(args) {
    const { where: when, label } = range(args);
    const where = { ...(when && { createdAt: when }), ...(args.status && { status: args.status }) };
    const [items, agg] = await Promise.all([
      prisma.withdrawal.findMany({ where, orderBy: { createdAt: "desc" }, take: args.limit, include: { store: { select: { name: true } } } }),
      prisma.withdrawal.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
    ]);
    return {
      period: label,
      total: agg._count._all,
      totalAmount: money(agg._sum.amount),
      withdrawals: items.map((w) => ({ store: w.store?.name, amount: money(w.amount), status: w.status, failureReason: w.failureReason, createdAt: w.createdAt, completedAt: w.completedAt })),
    };
  },

  async recent_activity(args) {
    const { where: when, label } = range(args);
    const where = {
      ...(when && { createdAt: when }),
      ...(args.action && { action: { contains: args.action.toUpperCase() } }),
      ...(args.entityType && { entityType: { equals: args.entityType, mode: "insensitive" } }),
      ...(args.actor && { actor: { email: { contains: args.actor, mode: "insensitive" } } }),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: args.limit, include: { actor: { select: { email: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    return {
      period: label,
      total,
      events: items.map((e) => ({ at: e.createdAt, action: e.action, by: e.actor?.email ?? e.actorRole ?? "system", role: e.actorRole, entity: e.entityType ? `${e.entityType} ${e.entityId ? shortId(e.entityId) : ""}`.trim() : null, details: e.metadata ? JSON.stringify(e.metadata).slice(0, 200) : null })),
    };
  },
};

/** Validates the model's arguments, runs the tool, and keeps the order rows aside as cards. */
async function execute(name, rawArgs, cards) {
  const schema = inputs[name];
  if (!schema) return { error: `Unknown tool ${name}.` };
  const result = await tools[name](schema.parse(rawArgs ?? {}));
  for (const order of result._orders ?? []) cards.set(order.id, { id: order.id, shortId: shortId(order.id), reference: order.group?.reference ?? null, title: order.advertisement?.title ?? "", status: order.status, totalAmount: String(order.totalAmount), createdAt: order.createdAt });
  const { _orders, ...visible } = result;
  return JSON.parse(JSON.stringify(visible)); // plain JSON (dates → strings) for the model
}

/* ------------------------------------------------------------------------- */
/* Chat                                                                       */
/* ------------------------------------------------------------------------- */

/** Calendar ranges spelled out for the model (Douala dates), so "this week" never guesses its Monday. */
function calendar(now = new Date()) {
  const day = (offset) => doualaDate(new Date(now.getTime() + offset * 24 * 60 * 60 * 1000));
  const today = doualaDate(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const sinceMonday = (weekday + 6) % 7;
  const monthStart = `${today.slice(0, 8)}01`;
  const prevMonthEnd = doualaDate(new Date(Date.parse(`${monthStart}T12:00:00Z`) - 24 * 60 * 60 * 1000));
  const weekdayName = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return {
    today,
    weekdayName,
    yesterday: day(-1),
    thisWeek: [day(-sinceMonday), today],
    lastWeek: [day(-sinceMonday - 7), day(-sinceMonday - 1)],
    thisMonth: [monthStart, today],
    lastMonth: [`${prevMonthEnd.slice(0, 8)}01`, prevMonthEnd],
    last7: [day(-6), today],
    last30: [day(-29), today],
  };
}

function systemPrompt({ locale, admin }) {
  const c = calendar();
  return `You are the SmartPlaze back-office analyst. You answer the Super Admin (${admin.firstName} ${admin.lastName}) about what happens on the SmartPlaze marketplace in Cameroon: orders, cart checkouts, payments, escrow, disputes, refunds, stores, withdrawals and staff activity.

Today is ${c.weekdayName} ${c.today} (Africa/Douala time, UTC+1). Use exactly these ranges (from–to, inclusive): today ${c.today}–${c.today}; yesterday ${c.yesterday}–${c.yesterday}; this week ${c.thisWeek[0]}–${c.thisWeek[1]}; last week ${c.lastWeek[0]}–${c.lastWeek[1]}; this month ${c.thisMonth[0]}–${c.thisMonth[1]}; last month ${c.lastMonth[0]}–${c.lastMonth[1]}; last 7 days ${c.last7[0]}–${c.last7[1]}; last 30 days ${c.last30[0]}–${c.last30[1]}. Other dates the admin names: convert them to YYYY-MM-DD.

Rules:
- Every number, name, status and amount must come from a tool call. Never estimate or invent. If a tool returns nothing, say so plainly.
- Pick the most specific tool: platform_summary for "what happened", search_orders for order questions with filters, get_order for one order or cart reference, list_disputes, list_stores (PENDING = awaiting approval), top_stores, list_payments, list_withdrawals, recent_activity for who-did-what.
- Always state the period and filters you used on the first line.
- Be concise: a short intro sentence, then bullet points starting with "• ". Plain text only: no markdown, no asterisks, no headings. Amounts in FCFA as returned. Refer to orders by their short id (8 characters) or cart reference. The order cards under your answer link to each order, so do not paste URLs.
- Mention what needs attention (orders waiting for delivery, open disputes, stores awaiting approval, failed payments or withdrawals) when relevant.
- Answer in ${locale === "fr" ? "French" : "English"} unless the admin writes in the other language.`;
}

/** Plain summary of today when Gemini cannot answer (no key, quota, outage). */
async function fallbackReply(locale, reason) {
  const s = await tools.platform_summary({});
  const fr = locale === "fr";
  const lines = [
    fr ? `L'assistant IA n'est pas disponible pour le moment (${reason}). Voici le résumé d'aujourd'hui :` : `The AI assistant is not available right now (${reason}). Here is today's summary:`,
    `• ${fr ? "Commandes" : "Orders"}: ${s.orders.total} (${s.orders.valueExcludingCancelledUnpaidRefunded}), ${fr ? "paniers" : "cart checkouts"}: ${s.orders.cartCheckouts}`,
    `• ${fr ? "Nouveaux clients" : "New customers"}: ${s.newCustomers}, ${fr ? "invités" : "guests"}: ${s.guestBuyers}`,
    `• ${fr ? "Litiges ouverts aujourd'hui" : "Disputes opened today"}: ${s.disputes.opened}`,
    `• ${fr ? "Sous séquestre" : "In escrow"}: ${s.now.escrowHeld} (${s.now.escrowOrders})`,
    `• ${fr ? "À livrer" : "Waiting for delivery"}: ${s.now.ordersAwaitingDelivery} · ${fr ? "Boutiques à valider" : "Stores awaiting approval"}: ${s.now.storesAwaitingApproval} · ${fr ? "Litiges en cours" : "Open disputes"}: ${s.now.openDisputes}`,
    fr ? "Réessayez dans une minute pour une réponse détaillée." : "Try again in a minute for a detailed answer.",
  ];
  return lines.join("\n");
}

async function chat({ messages, locale = "en", admin }) {
  const cards = new Map();
  if (!gemini.isAvailable()) {
    const reason = gemini.isConfigured() ? (locale === "fr" ? "limite de requêtes atteinte" : "request limit reached") : locale === "fr" ? "clé non configurée" : "no API key configured";
    return { reply: await fallbackReply(locale, reason), orders: [], model: "fallback", usage: { input: 0, output: 0 } };
  }
  try {
    const result = await gemini.runToolLoop({
      system: systemPrompt({ locale, admin }),
      tools: TOOLS,
      messages,
      execute: (name, args) => execute(name, args, cards),
    });
    const reply = result.blocked
      ? locale === "fr" ? "Je ne peux pas répondre à cette demande." : "I can't answer that request."
      : result.text || (locale === "fr" ? "Je n'ai pas pu formuler de réponse. Pouvez-vous reformuler ?" : "I couldn't come up with an answer. Could you rephrase?");
    return { reply, orders: [...cards.values()].slice(0, 12), model: result.model, usage: result.usage };
  } catch (error) {
    if (!["ASSISTANT_UNAVAILABLE", "ASSISTANT_BUSY", "ASSISTANT_ERROR"].includes(error.code)) throw error;
    logger.warn({ code: error.code }, "[admin-assistant] Gemini failed, sending the plain summary");
    const reason = error.code === "ASSISTANT_BUSY" ? (locale === "fr" ? "limite de requêtes atteinte" : "request limit reached") : locale === "fr" ? "service indisponible" : "service unavailable";
    return { reply: await fallbackReply(locale, reason), orders: [], model: "fallback", usage: { input: 0, output: 0 } };
  }
}

const status = () => ({ configured: gemini.isConfigured(), available: gemini.isAvailable(), model: require("../config/env").assistant.model });

module.exports = { chat, status, tools, inputs, TOOLS, range, calendar };
