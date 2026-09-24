import type { User, UserRole } from "@/types";

/** Mirrors backend `utils/roles.js` — the API is the source of truth, this only drives UI visibility. */
export const STAFF_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ACCOUNTANT", "CUSTOMER_SERVICE"];
export const OPERATIONS_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "CUSTOMER_SERVICE"];
export const FINANCE_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ACCOUNTANT"];

export const isStaff = (user?: User | null) => !!user && STAFF_ROLES.includes(user.role);
/** Moderation: users/stores/categories/plans/listings/disputes status. */
export const canOperate = (user?: User | null) => !!user && OPERATIONS_ROLES.includes(user.role);
/** Money: payments, withdrawals, releasing / refunding escrow. */
export const canFinance = (user?: User | null) => !!user && FINANCE_ROLES.includes(user.role);
export const isSuperAdmin = (user?: User | null) => user?.role === "SUPER_ADMIN";
