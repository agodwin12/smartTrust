// Single source of truth for who-can-do-what. Routes reference these groups
// instead of spelling out role lists inline, so the policy is readable in one
// place and a change here applies everywhere at once.
//
//   SUPER_ADMIN       everything, and the only role that can create staff or change roles
//   ACCOUNTANT        finance: sees payments/withdrawals/escrow, VALIDATES escrow releases/refunds
//   CUSTOMER_SERVICE  operations: users, stores, listings, categories, plans, disputes —
//                     everything EXCEPT validating escrow or initiating any payment
//   CUSTOMER          buyers and sellers (a seller is a customer who owns a Store)

const ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  ACCOUNTANT: "ACCOUNTANT",
  CUSTOMER_SERVICE: "CUSTOMER_SERVICE",
  CUSTOMER: "CUSTOMER",
});

const STAFF = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.CUSTOMER_SERVICE];
const OPERATIONS = [ROLES.SUPER_ADMIN, ROLES.CUSTOMER_SERVICE];
const FINANCE = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT];
const ESCROW_VALIDATORS = FINANCE;

// Used to stop a lower-ranked staff member acting on a higher-ranked account
// (e.g. Customer Service suspending the Super Admin).
const RANK = Object.freeze({
  [ROLES.SUPER_ADMIN]: 3,
  [ROLES.ACCOUNTANT]: 2,
  [ROLES.CUSTOMER_SERVICE]: 2,
  [ROLES.CUSTOMER]: 1,
});

function outranks(actorRole, targetRole) {
  return (RANK[actorRole] ?? 0) > (RANK[targetRole] ?? 0);
}

module.exports = { ROLES, STAFF, OPERATIONS, FINANCE, ESCROW_VALIDATORS, RANK, outranks };
