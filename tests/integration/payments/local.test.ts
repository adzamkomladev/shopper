import { expect, test } from "vite-plus/test";
import { paymentIntent } from "@shopper/db-sqlite";
import { applyDraftPayment, storePaymentUpdate } from "@shopper/core/till";
import { add, at, ctx, products, scope, withTill, world } from "../../support/till/drafts";

test.each(["failed", "expired", "confirmed"] as const)(
  "delayed pending and OTP cannot replace local %s, but late success can confirm",
  async (terminal) => {
    await withTill(async (db) => {
      await world(db);
      await add(db, 0, { productId: products.ordinary.id });
      const input = {
        scope,
        at,
        reference: "019a0000-0000-7000-8000-000000000092",
        amount: 12_000,
        phone: "******4987",
        network: "mtn",
      };
      await applyDraftPayment(db, ctx, { ...input, expectedRevision: 1, status: "pending" });
      const failureReason = terminal === "confirmed" ? null : "The payment ended";
      await storePaymentUpdate(db, ctx, { ...input, status: terminal, failureReason });
      await applyDraftPayment(db, ctx, {
        ...input,
        expectedRevision: 2,
        status: terminal,
        failureReason,
      });
      let expectedRevision = 3;
      for (const status of ["pending", "otp"] as const) {
        const stored = await storePaymentUpdate(db, ctx, {
          ...input,
          status,
          failureReason: "Old reply",
        });
        expect(stored).toMatchObject({ status: terminal, failureReason });
        const view = await applyDraftPayment(db, ctx, {
          ...input,
          status,
          failureReason: "Old reply",
          expectedRevision: expectedRevision++,
        });
        expect(view.draft?.tenders[0]?.status).toBe(terminal);
        const [intent] = await db.read((tx) => tx.select().from(paymentIntent));
        expect(intent).toMatchObject({ status: terminal, failureReason });
      }
      await storePaymentUpdate(db, ctx, { ...input, status: "confirmed", failureReason: null });
      const confirmed = await applyDraftPayment(db, ctx, {
        ...input,
        status: "confirmed",
        failureReason: null,
        expectedRevision,
      });
      expect(confirmed.draft?.tenders[0]?.status).toBe("confirmed");
      expect("settlement" in confirmed && confirmed.settlement?.balance).toBe(0);
      const [intent] = await db.read((tx) => tx.select().from(paymentIntent));
      expect(intent).toMatchObject({ status: "confirmed", failureReason: null });
    });
  },
);
