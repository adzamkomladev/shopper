import {
  addToDraft,
  readDraft,
  addDraftTender,
  completeDraftSale,
  setDraftDiscount,
  holdDraftSale,
  resumeDraftSale,
  voidDraftSale,
  provisionTillReference,
} from "@shopper/core/till";
import { expect } from "vite-plus/test";
import type { GoldenSale } from "../../../fixtures/sales/golden/types";
import { products } from "../../../fixtures/sales/golden/references";
import type { goldenWorld } from "./setup";
import { at } from "./setup";
import { confirmedPayment } from "./payment";
import { api } from "../../till/server";
import { pushEvents } from "../../till/requests";

export async function runGolden(
  world: Awaited<ReturnType<typeof goldenWorld>>,
  scenario: GoldenSale,
) {
  const { local, scope, command, session, config } = world;
  await provisionTillReference(local, command, {
    products: [],
    prices: [],
    taxRules: [],
    cashRounding: scenario.rounding ?? "10p",
  });
  let view = await readDraft(local, scope, { at });
  for (const line of scenario.lines) {
    view = await addToDraft(local, command, {
      scope,
      at,
      expectedRevision: view.draft?.revision ?? 0,
      ...(line.code
        ? { code: line.code }
        : { productId: products[line.product].id, quantityThousandths: line.quantity ?? 1000 }),
    });
    if (line.discount) {
      const added = view.draft?.lines.at(-1);
      if (!added) throw new Error("Expected added golden line");
      view = await setDraftDiscount(local, command, {
        scope,
        at,
        session,
        expectedRevision: view.draft?.revision ?? 0,
        lineId: added.id,
        discount: line.discount,
      });
    }
  }
  if (!view.draft) throw new Error("Expected golden draft");
  if (scenario.voided) {
    await voidDraftSale(local, command, {
      scope,
      at,
      session,
      expectedRevision: view.draft.revision,
      reason: "Golden customer cancelled",
    });
    return null;
  }
  if (scenario.held) {
    view = await holdDraftSale(local, command, {
      scope,
      at,
      expectedRevision: view.draft.revision,
      name: scenario.name,
    });
    if (!view.draft) throw new Error("Expected held golden draft");
    view = await resumeDraftSale(local, command, {
      scope,
      at,
      expectedRevision: view.draft.revision,
      draftId: view.draft.id,
    });
  }
  for (const tender of scenario.tenders) {
    if (!view.draft) throw new Error("Expected golden tender draft");
    if (tender.kind === "momo") {
      await confirmedPayment(world, view.draft.revision, tender.amount);
      view = await readDraft(local, scope, { at });
    } else
      view = await addDraftTender(local, command, {
        scope,
        at,
        expectedRevision: view.draft.revision,
        ...tender,
        ...(tender.kind === "card" ? { approvalCode: "GOLD123", last4: "4242" } : {}),
      });
  }
  const event = await completeDraftSale(local, config, session, {
    scope,
    at,
    expectedRevision: view.draft?.revision ?? 0,
  });
  const response = await pushEvents(
    api,
    [event],
    [{ sessionId: session.id, proof: session.proof }],
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [{ localId: event.sale.localId, sequence: expect.any(String) }],
    rejected: [],
  });
  return event.sale;
}
