import { and, eq } from "drizzle-orm";
import { org, branch, device, user, payment, type ShopperTransaction } from "@shopper/db-pg";
import type { SaleSnapshot } from "../schemas/till/sale";
import { buildReceipt } from "../receipts/build";

/** The names a receipt prints for an org, branch, register and cashier. */
export async function receiptNames(
  tx: ShopperTransaction,
  snapshot: Pick<SaleSnapshot, "orgId" | "branchId" | "deviceId" | "cashierId">,
) {
  const [names] = await tx
    .select({
      orgName: org.name,
      tin: org.tin,
      branchName: branch.name,
      deviceName: device.name,
      cashierName: user.name,
    })
    .from(org)
    .leftJoin(branch, and(eq(branch.orgId, org.id), eq(branch.id, snapshot.branchId)))
    .leftJoin(device, and(eq(device.orgId, org.id), eq(device.id, snapshot.deviceId)))
    .leftJoin(user, and(eq(user.orgId, org.id), eq(user.id, snapshot.cashierId)))
    .where(eq(org.id, snapshot.orgId));
  return {
    orgName: names?.orgName,
    tin: names?.tin,
    branchName: names?.branchName ?? undefined,
    deviceName: names?.deviceName ?? undefined,
    cashierName: names?.cashierName ?? undefined,
  };
}

export async function saleDocument(tx: ShopperTransaction, snapshot: SaleSnapshot) {
  const tenderPhones: Record<string, string> = {};
  for (const tender of snapshot.tenders)
    if (tender.kind === "momo" && tender.reference) {
      const [intent] = await tx
        .select({ phone: payment.phone })
        .from(payment)
        .where(and(eq(payment.orgId, snapshot.orgId), eq(payment.reference, tender.reference)));
      if (intent) tenderPhones[tender.id] = intent.phone;
    }
  return buildReceipt(snapshot, { ...(await receiptNames(tx, snapshot)), tenderPhones });
}
