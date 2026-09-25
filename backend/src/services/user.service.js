const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { auth } = require("../config/env");
const ApiError = require("../utils/ApiError");
const { revokeAllUserTokens } = require("./token.service");
const cacheService = require("./cache.service");
const { ROLES, outranks } = require("../utils/roles");

function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function getById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { store: { select: { id: true, name: true, slug: true, status: true, reviewNote: true } } },
  });
  if (!user) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  return toSafeUser(user);
}

async function updateProfile(userId, data) {
  const user = await prisma.user.update({ where: { id: userId }, data });
  await cacheService.invalidateKey(cacheService.userKey(userId));
  return toSafeUser(user);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");

  // A Google-only account has no local password to change — bcrypt.compare would
  // throw on a null hash instead of failing cleanly.
  if (!user.passwordHash) {
    throw new ApiError(422, "This account signs in with Google and has no password to change.", "NO_LOCAL_PASSWORD");
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new ApiError(401, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
  }

  const passwordHash = await bcrypt.hash(newPassword, auth.bcryptSaltRounds);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Changing the password invalidates every other session — a compromised
  // session shouldn't survive a password change.
  await revokeAllUserTokens(userId);
}

async function listUsers({ page = 1, pageSize = 20, role, status, search } = {}) {
  const where = {
    ...(role && { role }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { store: { select: { id: true, name: true, slug: true, status: true, reviewNote: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return { items: items.map(toSafeUser), total, page, pageSize };
}

/**
 * Guards every staff action taken ON another account:
 *  - never on yourself (a Super Admin can't lock themselves out by accident)
 *  - only on someone you strictly outrank (Customer Service can act on customers,
 *    NOT on the Super Admin or on each other — that was a real privilege-
 *    escalation hole: any CS account could have suspended the Super Admin)
 */
async function assertCanActOn(actor, targetId) {
  if (actor.id === targetId) {
    throw new ApiError(422, "You cannot change your own account this way.", "CANNOT_ACT_ON_SELF");
  }
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  if (!outranks(actor.role, target.role)) {
    throw new ApiError(403, "You cannot act on an account with equal or higher privileges.", "INSUFFICIENT_RANK");
  }
  return target;
}

/** Refuses to remove the last active Super Admin — there must always be someone who can administer the platform. */
async function assertNotLastSuperAdmin(target) {
  if (target.role !== ROLES.SUPER_ADMIN || target.status !== "ACTIVE") return;
  const others = await prisma.user.count({
    where: { role: ROLES.SUPER_ADMIN, status: "ACTIVE", id: { not: target.id } },
  });
  if (others === 0) {
    throw new ApiError(422, "This is the last active Super Admin account.", "LAST_SUPER_ADMIN");
  }
}

async function updateStatus(actor, userId, status) {
  const target = await assertCanActOn(actor, userId);
  if (status !== "ACTIVE") await assertNotLastSuperAdmin(target);

  const user = await prisma.user.update({ where: { id: userId }, data: { status } });

  if (status !== "ACTIVE") await revokeAllUserTokens(userId);
  await cacheService.invalidateKey(cacheService.userKey(userId));

  return toSafeUser(user);
}

/** SUPER_ADMIN only (route-enforced). */
async function updateRole(actor, userId, role) {
  if (actor.id === userId) {
    throw new ApiError(422, "You cannot change your own role.", "CANNOT_ACT_ON_SELF");
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  if (target.role === role) return toSafeUser(target);

  if (role !== ROLES.SUPER_ADMIN) await assertNotLastSuperAdmin(target);

  const user = await prisma.user.update({ where: { id: userId }, data: { role } });
  await cacheService.invalidateKey(cacheService.userKey(userId));
  return toSafeUser(user);
}

/** SUPER_ADMIN only (route-enforced) — creates an ACCOUNTANT / CUSTOMER_SERVICE / SUPER_ADMIN account. */
async function createStaff({ email, password, firstName, lastName, phone, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "An account with this email already exists.", "EMAIL_IN_USE");

  const passwordHash = await bcrypt.hash(password, auth.bcryptSaltRounds);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      role,
      // Created by the Super Admin directly — no sign-up OTP dance for staff.
      emailVerifiedAt: new Date(),
    },
  });
  return toSafeUser(user);
}

module.exports = {
  toSafeUser,
  getById,
  updateProfile,
  changePassword,
  listUsers,
  updateStatus,
  updateRole,
  createStaff,
};
