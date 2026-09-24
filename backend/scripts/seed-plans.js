#!/usr/bin/env node
/*
 * Upserts the three subscription plans (by name). Safe to re-run; needed before prisma/seed.js
 * on a fresh database and on first deployment.
 */
require("dotenv").config();
const prisma = require("../src/config/prisma");

const PLANS = [
  { name: "Starter", price: 5000, durationDays: 30, adQuota: 10, heroEligible: false, heroDurationHours: null, features: ["10 listings", "30 days", "Standard support"] },
  { name: "Business", price: 15000, durationDays: 90, adQuota: 50, heroEligible: true, heroDurationHours: 48, features: ["50 listings", "90 days", "Hero placement 48h", "Priority support"] },
  { name: "Premium", price: 50000, durationDays: 365, adQuota: 200, heroEligible: true, heroDurationHours: 72, features: ["200 listings", "1 year", "Hero placement 72h", "Priority support", "Featured store"] },
];

async function main() {
  for (const plan of PLANS) {
    const row = await prisma.subscriptionPlan.upsert({ where: { name: plan.name }, create: { ...plan, isActive: true }, update: plan, select: { name: true, adQuota: true, durationDays: true } });
    console.log(`plan ${row.name}: ${row.adQuota} ads / ${row.durationDays} days`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
