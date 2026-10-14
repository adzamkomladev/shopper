import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import {
  cashierSessionProof,
  deviceToken,
  deviceId,
  recordSale,
} from "../../../support/till/server";
import { createRuntimeApi, syncHeaders } from "../../../support/till/requests";

test("runtime routes authorize sync from device identity before browser tenant fallback", async () => {
  const runtime = await createRuntimeApi();
  const captured = await recordSale();
  const requestId = v7();
  const headers = syncHeaders();
  delete headers["X-Shopper-Org"];
  const accepted = await runtime.request("/sync/push", {
    method: "POST",
    headers,
    body: JSON.stringify({
      requestId,
      protocol: 1,
      events: [captured.event],
      proofs: [{ sessionId: captured.sessionId, proof: captured.proof }],
    }),
  });
  expect(accepted.status).toBe(200);

  const forgedSelector = await runtime.request("/sync/push", {
    method: "POST",
    headers: { ...syncHeaders(), "X-Shopper-Org": v7() },
    body: JSON.stringify({
      requestId: v7(),
      protocol: 1,
      events: [captured.event],
      proofs: [{ sessionId: captured.sessionId, proof: captured.proof }],
    }),
  });
  expect([400, 401, 403]).toContain(forgedSelector.status);

  const cashier = cashierSessionProof();
  const browserOnly = await runtime.request("/sync/push", {
    method: "POST",
    headers: {
      ...syncHeaders(),
      authorization: `Bearer ${cashier.proof}`,
      "X-Shopper-Device": deviceId,
    },
    body: JSON.stringify({
      requestId: v7(),
      protocol: 1,
      events: [captured.event],
      proofs: [{ sessionId: cashier.id, proof: cashier.proof }],
    }),
  });
  expect(browserOnly.status).toBe(401);
  expect(deviceToken).not.toBe(cashier.proof);
  await runtime.close();
});
