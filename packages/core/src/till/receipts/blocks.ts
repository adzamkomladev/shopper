import { and, asc, eq, gt, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { branch, device, receiptBlock, type ShopperDatabase } from "@shopper/db-pg";
import type { UploadPrincipal } from "../../sales/validate";

export function issueReceiptBlocks(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  lastUsed: number,
  appVersion: string,
) {
  return issue(
    db,
    {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      appVersion,
    },
    { principal, lastUsed },
  );
}
const issue = defineCommand({
  name: "device.receipts.issue",
  async run(tx, ctx, input: { principal: UploadPrincipal; lastUsed: number }) {
    const [registered] = await tx
      .select()
      .from(device)
      .where(and(eq(device.orgId, ctx.orgId), eq(device.id, input.principal.deviceId)))
      .for("update");
    if (!registered || input.lastUsed > registered.receiptLast)
      throw new Error("Invalid receipt cursor");
    const lastUsed = Math.max(input.lastUsed, registered.receiptUsed);
    if (lastUsed !== registered.receiptUsed)
      await tx.update(device).set({ receiptUsed: lastUsed }).where(eq(device.id, registered.id));
    const [location] = await tx
      .select()
      .from(branch)
      .where(and(eq(branch.orgId, ctx.orgId), eq(branch.id, registered.branchId)));
    if (!location) throw new Error("Branch not found");
    const blocks = await tx
      .select({ start: receiptBlock.start, end: receiptBlock.end })
      .from(receiptBlock)
      .where(
        and(
          eq(receiptBlock.orgId, ctx.orgId),
          eq(receiptBlock.deviceId, registered.id),
          gt(receiptBlock.end, lastUsed),
        ),
      )
      .orderBy(asc(receiptBlock.start));
    while (blocks.length < 2) {
      const [next] = await tx
        .update(device)
        .set({ receiptLast: sql`${device.receiptLast} + 1000` })
        .where(eq(device.id, registered.id))
        .returning({ end: device.receiptLast });
      if (!next) throw new Error("Device not found");
      const block = { start: next.end - 999, end: next.end };
      await tx.insert(receiptBlock).values({ orgId: ctx.orgId, deviceId: registered.id, ...block });
      blocks.push(block);
    }
    return { branchCode: location.code, deviceCode: registered.code, blocks };
  },
  audit: (_input, output) => output,
});
