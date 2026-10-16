import { and, eq } from "drizzle-orm";
import { org, branch, device, user, payment, type ShopperTransaction } from "@shopper/db-pg";
import type { SaleSnapshot } from "../schemas/till/sale";
import { buildReceipt } from "../receipts/build";

export async function saleDocument(tx: ShopperTransaction, snapshot: SaleSnapshot) {
  const [organisation] = await tx.select().from(org).where(eq(org.id, snapshot.orgId));
  const [location] = await tx
    .select()
    .from(branch)
    .where(and(eq(branch.orgId, snapshot.orgId), eq(branch.id, snapshot.branchId)));
  const [register] = await tx
    .select()
    .from(device)
    .where(and(eq(device.orgId, snapshot.orgId), eq(device.id, snapshot.deviceId)));
  const [cashier] = await tx
    .select()
    .from(user)
    .where(and(eq(user.orgId, snapshot.orgId), eq(user.id, snapshot.cashierId)));
  const tenderPhones: Record<string, string> = {};
  for (const tender of snapshot.tenders)
    if (tender.kind === "momo" && tender.reference) {
      const [intent] = await tx
        .select({ phone: payment.phone })
        .from(payment)
        .where(and(eq(payment.orgId, snapshot.orgId), eq(payment.reference, tender.reference)));
      if (intent) tenderPhones[tender.id] = intent.phone;
    }
  return buildReceipt(snapshot, {
    orgName: organisation?.name,
    branchName: location?.name,
    deviceName: register?.name,
    cashierName: cashier?.name,
    tenderPhones,
  });
}
