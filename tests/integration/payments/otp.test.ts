import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import * as v from "valibot";
import { momoView } from "@shopper/core/payments";
import { readDraft } from "@shopper/core/till";
import type { BridgeMessage } from "@shopper/sync/bridge";
import { withDatabase } from "../../support/till/sales";
import { paymentHost } from "../../support/payments/host";

test("a wrong OTP publishes its retained error and a valid retry clears it while waiting", async () => {
  await withDatabase(async (path) => {
    const host = await paymentHost(path);
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
        if (payment.reference === reference) await host.payments.receive(payment);
      },
    );
    const messages = () =>
      (host.messages as BridgeMessage[]).filter(
        (message) => message.type === "payment" && message.payment.reference === reference,
      );
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
        .poll(
          async () =>
            (await readDraft(host.database, host.scope, { at: new Date() })).draft?.tenders[0]
              ?.status,
        )
        .toBe("otp");
      const beforeWrong = await readDraft(host.database, host.scope, { at: new Date() });
      await host.payments.request({
        id: v7(),
        type: "payment.momo.otp",
        reference,
        expectedRevision: beforeWrong.draft!.revision,
        otp: "000000",
      });
      await expect
        .poll(
          () =>
            messages().some(
              (message) =>
                message.type === "payment" &&
                message.payment.status === "otp" &&
                message.payment.failureReason?.includes("incorrect"),
            ),
          { timeout: 5000 },
        )
        .toBe(true);
      const beforeRetry = await readDraft(host.database, host.scope, { at: new Date() });
      await host.payments.request({
        id: v7(),
        type: "payment.momo.otp",
        reference,
        expectedRevision: beforeRetry.draft!.revision,
        otp: "123456",
      });
      await expect
        .poll(() => messages().at(-1))
        .toMatchObject({
          type: "payment",
          payment: { reference, status: "pending", failureReason: null },
        });
      expect(JSON.stringify(host.messages)).not.toContain("0551234986");
    } finally {
      await host.webhook(reference);
      await subscription.close();
      await host.close();
    }
  });
});
