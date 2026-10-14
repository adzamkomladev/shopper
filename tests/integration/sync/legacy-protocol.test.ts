import * as v from "valibot";
import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { api, appVersion, recordSale } from "../../support/till/server";
import { syncHeaders } from "../../support/till/requests";

test("protocol one replies remain readable by the published strict handshake and acknowledgment parsers", async () => {
  const requestId = v7();
  const reply = await api.request("/sync/handshake", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({ requestId, appVersion, protocol: 1 }),
  });
  expect(reply.status).toBe(200);
  expect(
    v.parse(
      v.strictObject({ requestId: v.string(), appVersion: v.string(), protocol: v.literal(1) }),
      await reply.json(),
    ),
  ).toMatchObject({ requestId, protocol: 1 });
  const captured = await recordSale();
  const {
    receiptNumber: _number,
    receiptOverflow: _overflow,
    clockOffsetMs: _offset,
    ...sale
  } = captured.event.sale;
  const pushed = await api.request("/sync/push", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({
      requestId,
      protocol: 1,
      events: [{ v: 1, type: "sale.recorded", sale }],
      proofs: [{ sessionId: captured.sessionId, proof: captured.proof }],
    }),
  });
  expect(pushed.status).toBe(200);
  const oldAcknowledgment = v.strictObject({
    requestId: v.string(),
    accepted: v.array(v.strictObject({ localId: v.string(), sequence: v.string() })),
    rejected: v.array(
      v.strictObject({ localId: v.string(), code: v.string(), message: v.string() }),
    ),
  });
  const result = v.parse(oldAcknowledgment, await pushed.json());
  expect(result.accepted).toMatchObject([{ localId: captured.event.sale.localId }]);
  expect(result.rejected).toEqual([]);
});
