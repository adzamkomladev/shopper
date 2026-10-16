import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { snapshotLine } from "@shopper/tax";
import { add, money } from "@shopper/money";
import { updateProduct } from "@shopper/core/catalogue";
import { api, databases, recordSale } from "../../../support/till/server";
import { push } from "../../../support/till/requests";

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

test("a captured tax classification still requires the exact dated tax rule", async () => {
  const captured = await recordSale();
  const line = captured.event.sale.lines[0];
  if (!line) throw new Error("Expected captured line");
  const { db, context } = databases();
  await updateProduct(db, context, { id: line.productId, data: { taxClass: "exempt" } });
  line.tax.rule = { ...line.tax.rule, vatBps: line.tax.rule.vatBps + 1 };
  const response = await push(api, captured.event, captured.proof, captured.sessionId);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [],
    rejected: [{ localId: captured.event.sale.localId, code: "INVALID_REFERENCE" }],
  });
});

test("repeated price references retain each line's captured tax classification", async () => {
  const captured = await recordSale({ lineCount: 2 });
  const second = captured.event.sale.lines[1];
  if (!second) throw new Error("Expected two captured lines");
  second.tax = snapshotLine({ ...second.tax, taxClass: "exempt" });
  const totals = { ...captured.event.sale.totals };
  for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] = money(0);
  for (const line of captured.event.sale.lines)
    for (const key of Object.keys(totals) as (keyof typeof totals)[])
      totals[key] = add(totals[key], line.tax[key]);
  captured.event.sale.totals = totals;
  const response = await push(api, captured.event, captured.proof, captured.sessionId);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [{ localId: captured.event.sale.localId }],
    rejected: [],
  });
});

test("a repeated price cannot authorize another product's sale line", async () => {
  const captured = await recordSale({ lineCount: 2 });
  const second = captured.event.sale.lines[1];
  if (!second) throw new Error("Expected two captured lines");
  second.productId = v7();
  const response = await push(api, captured.event, captured.proof, captured.sessionId);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [],
    rejected: [{ localId: captured.event.sale.localId, code: "INVALID_REFERENCE" }],
  });
});
