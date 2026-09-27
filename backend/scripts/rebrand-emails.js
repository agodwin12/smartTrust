/**
 * One-off: moves account emails from the old brand domain to the new one
 * (tech.elite@smartmarket.dev → tech.elite@smartplaze.com, guest placeholders too),
 * refusing to run if any new address is already taken. Safe to re-run.
 *
 *   node scripts/rebrand-emails.js
 */
require("dotenv").config();
const prisma = require("../src/config/prisma");
const cacheService = require("../src/services/cache.service");

const SWAPS = [
  ["@smartmarket.dev", "@smartplaze.com"],
  ["@guest.smartmarket.invalid", "@guest.smartplaze.invalid"],
];

async function main() {
  const moves = [];
  for (const [from, to] of SWAPS) {
    const users = await prisma.user.findMany({ where: { email: { endsWith: from } }, select: { id: true, email: true } });
    for (const u of users) moves.push({ id: u.id, from: u.email, to: u.email.slice(0, -from.length) + to });
  }
  const clashes = await prisma.user.findMany({ where: { email: { in: moves.map((m) => m.to) } }, select: { email: true } });
  if (clashes.length) throw new Error(`Already taken, nothing changed: ${clashes.map((c) => c.email).join(", ")}`);
  await prisma.$transaction(moves.map((m) => prisma.user.update({ where: { id: m.id }, data: { email: m.to } })));
  for (const m of moves) await cacheService.invalidateKey(cacheService.userKey(m.id)).catch(() => {});
  if (moves.length) {
    await prisma.auditLog.create({ data: { actorRole: "SYSTEM", action: "USER_EMAILS_REBRANDED", entityType: "User", metadata: { moves: moves.map(({ from, to }) => ({ from, to })) } } });
  }
  for (const m of moves) console.log(`${m.from} → ${m.to}`);
  console.log(`${moves.length} account(s) updated`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
