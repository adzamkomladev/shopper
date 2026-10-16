import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { paymentIntent } from "@shopper/db-sqlite";
import { sha256 } from "@shopper/utils";
import { applyDraftPayment, storePaymentUpdate } from "@shopper/core/till";
import { add, at, ctx, products, scope, withTill, world } from "../../support/till/drafts";

test("a durable local reservation rejects a different phone fingerprint with the same suffix", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { productId: products.ordinary.id });
    const phoneFingerprint = await sha256("0241234567");
    const input = {
      scope,
      at,
      reference: v7(),
      amount: 12_000,
      phone: "******4567",
      network: "mtn",
      status: "pending",
    };
    await applyDraftPayment(db, ctx, { ...input, phoneFingerprint, expectedRevision: 1 });
    await expect(
      applyDraftPayment(db, ctx, {
        ...input,
        phoneFingerprint: await sha256("0541234567"),
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_INVALID" });
    const [intent] = await db.read((tx) => tx.select().from(paymentIntent));
    expect(intent).toMatchObject({ phone: "******4567", phoneFingerprint });
  });
});

test("masked realtime updates retain the original private phone fingerprint", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { productId: products.ordinary.id });
    const phoneFingerprint = await sha256("0241234567");
    const input = {
      scope,
      at,
      reference: v7(),
      amount: 12_000,
      phone: "******4567",
      network: "mtn",
      failureReason: null,
    };
    await applyDraftPayment(db, ctx, {
      ...input,
      phoneFingerprint,
      status: "pending",
      expectedRevision: 1,
    });
    await storePaymentUpdate(db, ctx, { ...input, status: "otp" });
    const updated = await applyDraftPayment(db, ctx, {
      ...input,
      status: "otp",
      expectedRevision: 2,
    });
    expect(updated.draft?.tenders[0]).not.toHaveProperty("phoneFingerprint");
    const [intent] = await db.read((tx) => tx.select().from(paymentIntent));
    expect(intent).toMatchObject({ phoneFingerprint, status: "otp" });
  });
});

test("a masked-only recovered intent cannot establish a full phone identity by guessing its suffix", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { productId: products.ordinary.id });
    const input = {
      scope,
      at,
      reference: v7(),
      amount: 12_000,
      phone: "******4567",
      network: "mtn",
      failureReason: null,
      status: "pending",
    };
    await storePaymentUpdate(db, ctx, input);
    await expect(
      applyDraftPayment(db, ctx, {
        ...input,
        phoneFingerprint: await sha256("0241234567"),
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_INVALID" });
  });
});
