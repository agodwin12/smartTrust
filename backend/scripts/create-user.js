#!/usr/bin/env node
/*
 * Creates (or updates) an account with a given role — the way to get the first SUPER_ADMIN on a
 * fresh database, and to add staff accounts without going through sign-up + OTP.
 *
 *   EMAIL=admin@example.com PASSWORD='…' ROLE=SUPER_ADMIN FIRST_NAME=Ada LAST_NAME=Lovelace \
 *   node scripts/create-user.js
 *
 * ROLE is one of CUSTOMER, SUPER_ADMIN, ACCOUNTANT, CUSTOMER_SERVICE (default CUSTOMER).
 * Re-running with the same EMAIL updates the password, name and role.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");
const { auth } = require("../src/config/env");

const ROLES = ["CUSTOMER", "SUPER_ADMIN", "ACCOUNTANT", "CUSTOMER_SERVICE"];

async function main() {
  const { EMAIL, PASSWORD, ROLE = "CUSTOMER", FIRST_NAME = "Smart", LAST_NAME = "Market" } = process.env;
  if (!EMAIL || !PASSWORD) throw new Error("EMAIL and PASSWORD are required.");
  if (PASSWORD.length < 8) throw new Error("PASSWORD must be at least 8 characters.");
  if (!ROLES.includes(ROLE)) throw new Error(`ROLE must be one of ${ROLES.join(", ")}.`);

  const email = EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(PASSWORD, auth.bcryptSaltRounds);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, role: ROLE, firstName: FIRST_NAME, lastName: LAST_NAME, status: "ACTIVE", emailVerifiedAt: new Date() },
    update: { passwordHash, role: ROLE, firstName: FIRST_NAME, lastName: LAST_NAME, status: "ACTIVE", emailVerifiedAt: new Date() },
    select: { id: true, email: true, role: true },
  });
  console.log(`${user.role} ${user.email} (${user.id}) ready`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
