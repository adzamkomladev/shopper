import { test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { momoConformance } from "@shopper/conformance";
import { payment, workflowRun } from "@shopper/db-pg";
import { momoFixture } from "../../support/payments/momo";

momoConformance("box workflow", test, async () => {
  const f = await momoFixture();
  return {
    async start(phone) {
      if (phone === "0241234567") f.deps.timeoutMs = 1;
      const reply = await f.call("/payments/momo", "POST", {
        phone,
        amount: 10_000,
        network: "mtn",
      });
      if (!reply.ok) throw new Error(await reply.text());
      return ((await reply.json()) as { reference: string }).reference;
    },
    async retry(reference, phone) {
      const reply = await f.call("/payments/momo", "POST", {
        reference,
        phone,
        amount: 10_000,
        network: "mtn",
      });
      if (reply.status === 409) return false;
      if (!reply.ok) throw new Error(await reply.text());
      return true;
    },
    chargeCount: async (reference) =>
      f.fake.requests.filter(
        (request) =>
          request.path === "/charge" &&
          (request.body as { reference: string }).reference === reference,
      ).length,
    async otp(reference, otp) {
      const reply = await f.call(`/payments/momo/${reference}/otp`, "POST", { otp });
      if (!reply.ok) throw new Error(await reply.text());
    },
    async status(reference) {
      const [row] = await f.db.select().from(payment).where(eq(payment.reference, reference));
      return row!.status;
    },
    async run(reference) {
      const [row] = await f.db
        .select()
        .from(workflowRun)
        .where(eq(workflowRun.instanceId, reference));
      return { businessKey: row!.businessKey, status: row!.status };
    },
    close: () => f.close(),
  };
});
