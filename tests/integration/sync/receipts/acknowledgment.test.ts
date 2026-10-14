import { expect, test } from "vite-plus/test";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture } from "../../../support/till/push";

test("push receipt delivery without a new clock offset persists its audit and retires the queue", async () => {
  const fixture = await createPushFixture({
    alterResponse: async (response) => {
      const body = (await response.json()) as { accepted: Record<string, unknown>[] };
      return Response.json({
        ...body,
        accepted: body.accepted.map(({ occurredAt: _time, ...accepted }) => accepted),
      });
    },
  });
  try {
    await fixture.recordSale();
    const worker = createPushWorker(fixture.workerOptions);
    fixture.worker = worker;
    await worker.trigger();
    expect(await fixture.queue()).toHaveLength(0);
    expect(worker.getStatus()).toMatchObject({ server: "online", lastError: null });
    const { tillAudit } = await import("@shopper/db-sqlite");
    const audits = await fixture.database.read((tx) => tx.select().from(tillAudit));
    expect(audits.filter((row) => row.command === "till.receipts.sync")).toHaveLength(2);
  } finally {
    await fixture.close();
  }
});
