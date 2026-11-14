import { permissionNames } from "../schemas/permissions";
export const rolePermissions: Record<string, readonly string[]> = {
  superadmin: permissionNames,
  admin: permissionNames.filter(
    (code) =>
      !code.startsWith("store.") &&
      !code.startsWith("branch.") &&
      code !== "tax.write" &&
      code !== "billing.manage" &&
      code !== "migration.run",
  ),
  accountant: [
    "product.read",
    "shift.read",
    "stock.read",
    "tax.read",
    "tax.return",
    "report.read",
    "ledger.read",
    "ledger.write",
    "ledger.lock",
    "audit.read",
    "payment.reconcile",
    "customer.read",
    "customer.manage",
    "order.read",
  ],
  inventory: ["product.read", "stock.read", "stock.write", "product.propose"],
  cashier: [
    "product.read",
    "sale.create",
    "payment.momo",
    "refund.request",
    "shift.read",
    "shift.write",
    "customer.read",
    "customer.write",
    "order.read",
    "order.fulfil",
  ],
};
export const tillPermissions = new Set([
  "product.read",
  "sale.create",
  "sale.discount",
  "sale.void",
  "sale.price_override",
  "payment.momo",
  "refund.approve",
  "refund.request",
  "shift.read",
  "shift.write",
  "shift.approve",
  "register.settings",
  "report.read",
  "stock.read",
  "stock.write",
  "customer.read",
  "customer.write",
  "staff.unlock",
  "order.read",
  "order.fulfil",
]);
