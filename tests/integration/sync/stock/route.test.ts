import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { api } from "../../../support/till/server";
import { syncHeaders } from "../../../support/till/requests";
import { inventorySession, stockProduct } from "../../../support/till/stock";

async function upload(body: unknown, headers: Record<string, string> = syncHeaders()) {
  return api.request("/sync/stock", { method: "POST", headers, body: JSON.stringify(body) });
}

test("POST /sync/stock accepts a count from the device principal and replays it", async () => {
  const session = await inventorySession();
  const productId = await stockProduct(4_000);
  const body = {
    requestId: v7(),
    proof: session.proof,
    document: {
      v: 1,
      kind: "count",
      id: v7(),
      actorId: session.userId,
      sessionId: session.sessionId,
      lines: [{ productId, countedThousandths: 3_000 }],
      countedAt: "2025-12-31T22:00:00.000Z",
    },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await upload(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requestId: body.requestId,
      accepted: {
        id: body.document.id,
        kind: "count",
        occurredAt: "2025-12-31T22:00:00.000Z",
        lines: [{ productId, before: 4_000, counted: 3_000, delta: -1_000 }],
      },
    });
  }
});

test("POST /sync/stock needs a device credential and rejects a foreign session proof", async () => {
  const session = await inventorySession();
  const productId = await stockProduct();
  const body = {
    requestId: v7(),
    proof: "forged-proof",
    document: {
      v: 1,
      kind: "receipt",
      id: v7(),
      actorId: session.userId,
      sessionId: session.sessionId,
      lines: [{ productId, quantityThousandths: 1_000 }],
      receivedAt: "2025-12-31T22:00:00.000Z",
    },
  };
  expect((await upload(body, { "content-type": "application/json" })).status).toBe(401);
  const forged = await upload(body);
  expect(forged.status).toBe(200);
  expect(await forged.json()).toMatchObject({ rejected: { code: "INVALID_SESSION" } });
  const malformed = await upload({ ...body, proof: session.proof, document: { kind: "receipt" } });
  expect(await malformed.json()).toMatchObject({ rejected: { code: "INVALID_DOCUMENT" } });
});
