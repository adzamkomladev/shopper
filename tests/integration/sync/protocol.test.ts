import { afterAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { api, recordSale } from "../../support/till/server";
import { createSyncApi, pushEvents, syncHeaders } from "../../support/till/requests";

const clients: Awaited<ReturnType<typeof createSyncApi>>[] = [];
afterAll(async () => {
  for (const client of clients) await client.close();
});
test("production protocol one accepts only one; a later server accepts N and N-1", async () => {
  for (const [current, supported, incompatible] of [
    [1, [1], [0, 2]],
    [2, [1, 2], [0, 3]],
    [3, [2, 3], [1, 4]],
  ] as const) {
    const target = current === 1 ? api : await createSyncApi(current);
    if (target !== api) clients.push(target);
    for (const protocol of [...supported, ...incompatible]) {
      const response = await target.request("/sync/handshake", {
        method: "POST",
        headers: syncHeaders(),
        body: JSON.stringify({ requestId: v7(), appVersion: "test", protocol }),
      });
      expect(response.status).toBe(supported.includes(protocol as never) ? 200 : 409);
      if (response.status === 200) expect(await response.json()).toMatchObject({ protocol });
    }
  }
});
test("one rejected future event does not prevent a supported event in the same batch", async () => {
  const unsupported = await recordSale();
  const supported = await recordSale();
  const response = await pushEvents(
    api,
    [{ ...unsupported.event, v: 2 }, supported.event],
    [{ sessionId: supported.sessionId, proof: supported.proof }],
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [{ localId: supported.event.sale.localId }],
    rejected: [{ localId: unsupported.event.sale.localId, code: "UNSUPPORTED_EVENT_VERSION" }],
  });
});
