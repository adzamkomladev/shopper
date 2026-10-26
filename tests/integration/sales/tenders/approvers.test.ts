// An approver's standing is judged at the moment they approved: deactivation and branch scope both count only
// from when they took effect, so an override approved before either still uploads.
import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { branch, device, member, memberBranch } from "@shopper/db-pg";
import { memberWithPin } from "../../../support/sync/members";
import { databases, deviceId, recordSale } from "../../../support/till/server";
import { accept, listPrice, overridden, reason } from "../../../support/sales/override";

test("an approver deactivated before the sale no longer authorises it; one deactivated after still does", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Abena Manager", "admin", "2468");
  const event = overridden(created, 9_000, { listPrice: listPrice(created), reason, approverId });
  const { db } = databases();
  const approver = eq(member.userId, approverId);
  await db
    .update(member)
    .set({ deactivatedAt: new Date("2025-12-31T23:00:00Z") })
    .where(approver);
  await expect(accept(created, event)).rejects.toMatchObject({ code: "INVALID_SESSION" });
  await db
    .update(member)
    .set({ deactivatedAt: new Date("2025-12-31T23:45:00Z") })
    .where(approver);
  await expect(accept(created, event)).resolves.toMatchObject({ localId: event.sale.localId });
});

test("an approver scoped to another branch when they approved doesn't authorise it; one scoped later still does", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Kwame Manager", "admin", "2468");
  const event = overridden(created, 9_000, { listPrice: listPrice(created), reason, approverId });
  const { db } = databases();
  const [till] = await db
    .select({ orgId: branch.orgId, storeId: branch.storeId })
    .from(device)
    .innerJoin(branch, eq(branch.id, device.branchId))
    .where(eq(device.id, deviceId));
  const [elsewhere] = await db
    .insert(branch)
    .values({ orgId: till!.orgId, storeId: till!.storeId, name: "Elsewhere" })
    .returning({ id: branch.id });
  const [approver] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, approverId));
  const scopedAt = (createdAt: Date) =>
    db
      .insert(memberBranch)
      .values({ orgId: till!.orgId, memberId: approver!.id, branchId: elsewhere!.id, createdAt });
  await scopedAt(new Date("2025-12-31T23:00:00Z"));
  await expect(accept(created, event)).rejects.toMatchObject({ code: "INVALID_SESSION" });
  await db.delete(memberBranch).where(eq(memberBranch.memberId, approver!.id));
  await scopedAt(new Date("2025-12-31T23:45:00Z"));
  await expect(accept(created, event)).resolves.toMatchObject({ localId: event.sale.localId });
});
