import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { momoView } from "@shopper/core/payments";
import * as v from "valibot";
import { readDraft } from "@shopper/core/till";
import { withDatabase } from "../../support/till/sales";
import { paymentHost } from "../../support/payments/host";

test("the register reserves its reference before charging and applies a confirmed update", async () => {
  await withDatabase(async (path) => {
    const host = await paymentHost(path);
    try {
      const reference = v7();
      const pending = await host.payments.request({
        id: reference,
        type: "payment.momo.start",
        expectedRevision: 1,
        phone: "0551234987",
        network: "mtn",
        amount: 10_000,
      });
      expect(pending.draft?.tenders).toMatchObject([{ reference, phone: "******4987" }]);
      await expect
        .poll(async () => (await (await host.call(`/payments/momo/${reference}`)).json()).status)
        .toBe("confirmed");
      const result = await host.call(`/payments/momo/${reference}`);
      const confirmed = v.parse(momoView, await result.json());
      await host.payments.receive(confirmed);
      const view = await readDraft(host.database, host.scope, { at: new Date() });
      expect(view.draft?.tenders).toMatchObject([{ reference, status: "confirmed" }]);
      expect("settlement" in view && view.settlement?.balance).toBe(0);
      expect(host.messages.filter((message) => message.type === "draft")).toMatchObject([
        { type: "draft", view: { draft: { tenders: [{ status: "confirmed" }] } } },
      ]);
    } finally {
      await host.close();
    }
  });
});

test("retry after a lost creation reply keeps one provider charge and one tender", async () => {
  await withDatabase(async (path) => {
    const host = await paymentHost(path, { failFirstStartReply: true });
    try {
      const reference = v7();
      const request = {
        id: reference,
        type: "payment.momo.start" as const,
        expectedRevision: 1,
        phone: "0241234567",
        network: "mtn" as const,
        amount: 10_000,
      };
      await expect(host.payments.request(request)).rejects.toMatchObject({
        code: "PAYMENT_UNAVAILABLE",
      });
      const reserved = await readDraft(host.database, host.scope, { at: new Date() });
      expect(reserved.draft?.tenders).toMatchObject([{ reference, status: "pending" }]);
      const retry = await host.payments.request({
        ...request,
        id: v7(),
        phone: "+233241234567",
        expectedRevision: reserved.draft!.revision,
      });
      expect(retry.draft?.tenders).toHaveLength(1);
      expect(retry.draft?.tenders[0]?.reference).toBe(reference);
      await expect
        .poll(() => host.fake.requests.filter((r) => r.path === "/charge").length)
        .toBe(1);
      expect((await host.webhook(reference)).status).toBe(200);
      await host.payments.recover();
      const confirmed = await readDraft(host.database, host.scope, { at: new Date() });
      expect(confirmed.draft?.tenders[0]?.status).toBe("confirmed");
    } finally {
      await host.close();
    }
  });
});

test("reconnect recovers a terminal decline missing from the unresolved payment list", async () => {
  await withDatabase(async (path) => {
    const host = await paymentHost(path);
    try {
      host.deps.timeoutMs = 60_000;
      const reference = v7();
      await host.payments.request({
        id: reference,
        type: "payment.momo.start",
        expectedRevision: 1,
        phone: "0241234567",
        network: "mtn",
        amount: 10_000,
      });
      expect((await host.webhook(reference, "charge.failed")).status).toBe(200);
      expect(await (await host.call("/payments/momo?status=unresolved")).json()).toMatchObject({
        payments: [],
      });
      await host.payments.recover();
      const view = await readDraft(host.database, host.scope, { at: new Date() });
      expect(view.draft?.tenders[0]?.status).toBe("failed");
      expect("settlement" in view && view.settlement?.balance).toBe(10_000);
    } finally {
      await host.close();
    }
  });
});

test("a retry rejects another full phone with the same masked suffix before sending it", async () => {
  await withDatabase(async (path) => {
    const host = await paymentHost(path, { failFirstStartReply: true });
    const reference = v7();
    try {
      const input = {
        id: reference,
        type: "payment.momo.start" as const,
        expectedRevision: 1,
        phone: "0241234567",
        network: "mtn" as const,
        amount: 10_000,
      };
      await expect(host.payments.request(input)).rejects.toMatchObject({
        code: "PAYMENT_UNAVAILABLE",
      });
      const current = await readDraft(host.database, host.scope, { at: new Date() });
      await expect(
        host.payments.request({
          ...input,
          id: v7(),
          phone: "0541234567",
          expectedRevision: current.draft!.revision,
        }),
      ).rejects.toMatchObject({ code: "DRAFT_BUSY" });
      await expect
        .poll(() => host.fake.requests.filter((request) => request.path === "/charge").length)
        .toBe(1);
    } finally {
      await host.webhook(reference);
      await host.close();
    }
  });
});
