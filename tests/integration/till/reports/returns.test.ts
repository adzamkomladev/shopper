import { expect, test } from "vite-plus/test";
import { registerReport } from "@shopper/core/till";
import { refund, sell, trade } from "../../../support/till/refunds";
import { world, withTill } from "../../../support/till/drafts";

test("the register report counts refunds by the day they were made, not the day of the sale", async () => {
  await withTill(async (db) => {
    await world(db);
    const first = await sell(db, "2025-12-30T10:00:00.000Z", 3_000);
    const second = await sell(db, "2025-12-30T11:00:00.000Z", 2_000);
    await refund(db, first, [[0, 1_000]], { at: "2025-12-31T09:00:00.000Z" });
    await refund(db, first, [[0, 500]], { at: "2025-12-31T09:30:00.000Z" });
    await refund(db, second, [[0, 2_000]], { at: "2026-01-01T00:30:00.000Z" });

    expect((await registerReport(db, trade("2025-12-31"))).returns).toEqual({
      count: 2,
      amount: 12_000 + 6_000,
    });
    expect((await registerReport(db, trade("2026-01-01"))).returns).toEqual({
      count: 1,
      amount: 24_000,
    });
    expect((await registerReport(db, trade("2025-12-30"))).returns).toEqual({
      count: 0,
      amount: 0,
    });
    const week = await registerReport(db, { from: "2025-12-30", to: "2026-01-01" });
    expect(week.returns).toEqual({ count: 3, amount: 42_000 });
    expect(week.totals).toMatchObject({ sales: 60_000, transactions: 2 });
  });
});
