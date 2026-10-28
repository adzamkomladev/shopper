import { afterEach, expect, test } from "vite-plus/test";
import { tillState } from "@shopper/db-sqlite";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture, type PushFixture } from "../../../support/till/push";

let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

test("a slow handshake does not count its round trip as clock skew", async () => {
  // Both clocks agree. The reply takes two seconds; the server stamped it halfway, as a real one would.
  fixture = await createPushFixture({
    alterHandshake: async (response) => {
      const body = (await response.json()) as Record<string, unknown>;
      const serverTime = new Date(fixture!.now + 1_000).toISOString();
      fixture!.advanceTime(2_000);
      return Response.json({ ...body, serverTime });
    },
  });
  await fixture.recordSale();
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  await worker.trigger();
  const [state] = await fixture.database.read((tx) => tx.select().from(tillState));
  expect(state?.clockOffsetMs).toBe(0);
});
