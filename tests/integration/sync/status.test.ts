import { expect, test } from "vite-plus/test";
import { api } from "../../support/till/server";
import { consumeSeqs, head, pullHeaders } from "../../support/till/pull";

test("sync status reports the authenticated store head and server time without a mutation", async () => {
  await consumeSeqs(3);
  const before = Date.now();
  const response = await api.request("/sync/status", { headers: pullHeaders() });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.head).toBe(String(await head()));
  expect(Date.parse(body.serverTime)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(body.serverTime)).toBeLessThanOrEqual(Date.now());
});

test("sync status rejects missing device credentials and incompatible protocols", async () => {
  expect((await api.request("/sync/status")).status).toBe(401);
  expect((await api.request("/sync/status", { headers: pullHeaders(0) })).status).toBe(409);
});
