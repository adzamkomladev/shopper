import { expect, test } from "vite-plus/test";
import { readFile } from "node:fs/promises";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { api, databases, deviceId, recordSale } from "../../support/till/server";
import { push } from "../../support/till/requests";

test("the new sale migration can be reapplied and accepted snapshots are immutable", async () => {
  const { db } = databases();
  const migration = await readFile(
    new URL("../../../packages/db/pg/migrations/0010_till_sales.sql", import.meta.url),
    "utf8",
  );
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) await db.execute(sql.raw(statement));
  }
  const captured = await recordSale();
  expect((await push(api, captured.event, captured.proof, captured.sessionId)).status).toBe(200);
  const filter = and(
    eq(schema.sale.deviceId, deviceId),
    eq(schema.sale.localId, captured.event.sale.localId),
  );
  const [saved] = await db.select().from(schema.sale).where(filter);
  expect(saved?.acceptedAt).toBeInstanceOf(Date);
  expect(saved?.deviceTime.toISOString()).toBe(captured.event.sale.deviceTime);
  await expect(db.update(schema.sale).set({ payload: {} }).where(filter)).rejects.toThrow();
  await expect(db.update(schema.sale).set({ storeSequence: 99n }).where(filter)).rejects.toThrow();
  await expect(db.delete(schema.sale).where(filter)).rejects.toThrow();
  await expect(
    db.update(schema.saleLine).set({ payload: {} }).where(eq(schema.saleLine.saleId, saved!.id)),
  ).rejects.toThrow();
  await expect(
    db.delete(schema.saleLine).where(eq(schema.saleLine.saleId, saved!.id)),
  ).rejects.toThrow();
});
