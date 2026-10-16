import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import * as v from "valibot";
import { momoView } from "@shopper/core/payments";
import { readDraft, storePaymentUpdate } from "@shopper/core/till";
import { FAKE_OTP } from "../../../tooling/paystack/server";
import { withDatabase } from "../../support/till/sales";
import { paymentHost } from "../../support/payments/host";

test.each(["creation", "otp"] as const)(
  "a delayed %s acknowledgement preserves the newer provider state",
  async (stage) => {
    await withDatabase(async (path) => {
      const observedOtp = deferred();
      const observedPending = deferred();
      const host = await paymentHost(path, {
        async beforeReply(requestPath, response) {
          if (stage === "creation" && requestPath === "/payments/momo") {
            expect(await response.clone().json()).toMatchObject({ status: "pending" });
            await observedOtp.promise;
          }
          if (stage === "otp" && requestPath.endsWith("/otp")) {
            expect(await response.clone().json()).toMatchObject({ status: "otp" });
            await observedPending.promise;
          }
        },
      });
      host.deps.timeoutMs = 60_000;
      host.fake.behave("0551234986", "send_otp", "pending");
      const reference = v7();
      const subscription = await host.realtime.subscribe(
        host.orgId,
        host.ids.store,
        v7(),
        "0",
        async (message) => {
          if (message.type !== "payment.updated") return;
          const payment = v.parse(momoView, message.payload);
          if (payment.reference !== reference) return;
          await host.payments.receive(payment);
          if (payment.status === "otp") observedOtp.resolve();
          if (payment.status === "pending") observedPending.resolve();
        },
      );
      try {
        const created = await host.payments.request({
          id: reference,
          type: "payment.momo.start",
          expectedRevision: 1,
          phone: "0551234986",
          network: "mtn",
          amount: 10_000,
        });
        if (stage === "creation") {
          expect(created.draft?.tenders[0]?.status).toBe("otp");
          expect(await (await host.call(`/payments/momo/${reference}`)).json()).toMatchObject({
            status: "otp",
          });
        } else {
          await observedOtp.promise;
          await host.payments.recover();
          const before = await readDraft(host.database, host.scope, { at: new Date() });
          const submitted = await host.payments.request({
            id: v7(),
            type: "payment.momo.otp",
            reference,
            expectedRevision: before.draft!.revision,
            otp: FAKE_OTP,
          });
          expect(submitted.draft?.tenders[0]?.status).toBe("pending");
          expect(await (await host.call(`/payments/momo/${reference}`)).json()).toMatchObject({
            status: "pending",
          });
        }
      } finally {
        await host.webhook(reference);
        await subscription.close();
        await host.close();
      }
    });
  },
);

test("an intent-only realtime update survives the delayed creation acknowledgement", async () => {
  await withDatabase(async (path) => {
    const reference = v7();
    const host = await paymentHost(path, {
      async beforeReply(requestPath) {
        if (requestPath !== "/payments/momo") return;
        await expect
          .poll(async () => (await (await host.call(`/payments/momo/${reference}`)).json()).status)
          .toBe("otp");
        const payment = v.parse(
          momoView,
          await (await host.call(`/payments/momo/${reference}`)).json(),
        );
        await storePaymentUpdate(host.database, host.context, {
          scope: host.scope,
          at: new Date(),
          ...payment,
        });
        const draft = await readDraft(host.database, host.scope, { at: new Date() });
        expect(draft.draft?.tenders[0]?.status).toBe("pending");
      },
    });
    host.deps.timeoutMs = 60_000;
    try {
      const result = await host.payments.request({
        id: reference,
        type: "payment.momo.start",
        expectedRevision: 1,
        phone: "0551234986",
        network: "mtn",
        amount: 10_000,
      });
      expect(result.draft?.tenders[0]?.status).toBe("otp");
    } finally {
      await host.webhook(reference);
      await host.close();
    }
  });
});

test("retry still recovers server OTP when the register missed its realtime update", async () => {
  await withDatabase(async (path) => {
    const host = await paymentHost(path);
    host.deps.timeoutMs = 60_000;
    const reference = v7();
    try {
      await host.payments.request({
        id: reference,
        type: "payment.momo.start",
        expectedRevision: 1,
        phone: "0551234986",
        network: "mtn",
        amount: 10_000,
      });
      await expect
        .poll(async () => (await (await host.call(`/payments/momo/${reference}`)).json()).status)
        .toBe("otp");
      const before = await readDraft(host.database, host.scope, { at: new Date() });
      expect(before.draft?.tenders[0]?.status).toBe("pending");
      const result = await host.payments.request({
        id: v7(),
        type: "payment.momo.start",
        expectedRevision: before.draft!.revision,
        phone: "+233551234986",
        network: "mtn",
        amount: 10_000,
      });
      expect(result.draft?.tenders[0]?.status).toBe("otp");
      expect(host.fake.requests.filter((request) => request.path === "/charge")).toHaveLength(1);
    } finally {
      await host.webhook(reference);
      await host.close();
    }
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((ready) => {
    resolve = ready;
  });
  return { promise, resolve };
}
