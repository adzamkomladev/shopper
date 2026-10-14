import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { sale } from "@shopper/db-pg";
import { acceptSale } from "@shopper/core/sales";
import { databases, deviceId, recordSale } from "../../../support/till/server";

test("a skewed offline sale preserves raw device time and uses corrected time for tax and session", async () => {
  const created = await recordSale();
  const event = structuredClone(created.event);
  const corrected = event.sale.deviceTime;
  event.sale.deviceTime = "2026-01-01T01:30:00.000Z";
  Object.assign(event.sale, { clockOffsetMs: 7_200_000 });
  const { db, context } = databases();
  await acceptSale(
    db,
    { orgId: context.orgId, deviceId, branchId: event.sale.branchId, storeId: event.sale.storeId },
    event,
    created.proof,
  );
  const [saved] = await db.select().from(sale).where(eq(sale.localId, event.sale.localId));
  expect(saved?.occurredAt?.toISOString()).toBe(corrected);
  expect(saved?.deviceTime.toISOString()).toBe(event.sale.deviceTime);
});

test("a future corrected timestamp is clamped to acceptance and keeps its tax date", async () => {
  const created = await recordSale();
  const { db, context } = databases();
  const acceptedTime = new Date("2025-12-31T23:00:00.000Z");
  await acceptSale(
    db,
    {
      orgId: context.orgId,
      deviceId,
      branchId: created.event.sale.branchId,
      storeId: created.event.sale.storeId,
    },
    created.event,
    created.proof,
    () => acceptedTime.valueOf(),
  );
  const [saved] = await db.select().from(sale).where(eq(sale.localId, created.event.sale.localId));
  expect(saved?.occurredAt.toISOString()).toBe(acceptedTime.toISOString());
  expect(saved?.deviceTime.toISOString()).toBe("2025-12-31T23:30:00.000Z");
});
