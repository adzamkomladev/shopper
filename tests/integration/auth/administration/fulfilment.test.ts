// Day 32 branch fulfilment: the owner sets how a branch takes online orders, in one audited write.
//   GET /branches/:id/fulfilment   (branch.read)  -> the saved settings, or the default (no online orders)
//   PUT /branches/:id/fulfilment   (branch.write) -> the saved settings; closes before opens is refused
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { auditLog } from "@shopper/db-pg";
import { api, cookies, db, otherApi, request } from "../setup";
import { branches } from "../members/support";

const settings = {
  pickup: true,
  delivery: true,
  deliveryFee: 150_000,
  opens: "07:30",
  closes: "19:00",
  slotMinutes: 30,
  slotCapacity: 6,
  leadMinutes: 90,
};

test("the owner turns on pickup and delivery with a fee, and the write is audited", async () => {
  const owner = cookies.get("superadmin")!;
  const [branchId] = await branches("Fulfilment branch");
  const path = `/branches/${branchId}/fulfilment`;
  const fresh = await request(api, owner, path);
  expect(fresh.status).toBe(200);
  expect(await fresh.json()).toMatchObject({ pickup: false, delivery: false, opens: "08:00" });

  const saved = await request(api, owner, path, "PUT", settings);
  expect(saved.status).toBe(200);
  expect(await (await request(api, owner, path)).json()).toEqual(settings);
  const audits = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.command, "branch.fulfilment_saved"), eq(auditLog.entityId, branchId!)));
  expect(audits).toHaveLength(1);
  expect(audits[0]!.payload).toMatchObject({ branchId, deliveryFee: 150_000 });

  const backwards = await request(api, owner, path, "PUT", { ...settings, closes: "07:00" });
  expect(backwards.status).toBe(400);
  expect(await backwards.json()).toMatchObject({
    issues: { closes: ["Closing must be after opening"] },
  });
});

test("a cashier cannot change it, and another shop cannot see or change it", async () => {
  const [branchId] = await branches("Fulfilment guarded");
  const path = `/branches/${branchId}/fulfilment`;
  expect((await request(api, cookies.get("cashier")!, path, "PUT", settings)).status).toBe(403);
  const other = cookies.get("other")!;
  expect((await request(otherApi, other, path)).status).toBe(404);
  expect((await request(otherApi, other, path, "PUT", settings)).status).toBe(404);
  expect(await (await request(api, cookies.get("superadmin")!, path)).json()).toMatchObject({
    pickup: false,
  });
});
