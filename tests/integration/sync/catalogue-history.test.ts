import { expect, test } from "vite-plus/test";
import { updateProduct } from "@shopper/core/catalogue";
import { api, databases, recordSale } from "../../support/till/server";
import { push } from "../../support/till/requests";

test("a later product tax classification does not rewrite a captured offline sale", async () => {
  const captured = await recordSale();
  const line = captured.event.sale.lines[0];
  if (!line) throw new Error("Expected captured line");
  const { db, context } = databases();
  await updateProduct(db, context, { id: line.productId, data: { taxClass: "exempt" } });
  const response = await push(api, captured.event, captured.proof, captured.sessionId);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [{ localId: captured.event.sale.localId }],
    rejected: [],
  });
});
