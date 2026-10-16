import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import { request } from "../connection/store";
import type { SaleSnapshot, TenderInput } from "./types";

type Body<T extends { id: string } = BridgeRequest> = T extends { id: string }
  ? Omit<T, "id">
  : never;
type Change = Partial<
  Pick<SaleSnapshot, "busy" | "loading" | "view" | "held" | "receipt" | "operationError">
>;
type Dependencies = {
  canEdit: () => boolean;
  canStartNewSale: () => boolean;
  revision: () => number;
  update: (change: Change) => void;
  report: (reply: BridgeMessage | undefined) => void;
};

export function createSaleOperations({
  canEdit,
  canStartNewSale,
  revision,
  update,
  report,
}: Dependencies) {
  /** `closes` names the status that ends the basket; the sale stays busy until its successor loads. */
  async function runDraft(body: (revision: number) => Body, closes?: "held" | "voided") {
    if (!canEdit()) return;
    update({ busy: true, operationError: null });
    const reply = await request(body(revision()));
    if (reply?.type === "result" && reply.kind === "draft") {
      update({ view: reply.view, operationError: null });
      if (closes && reply.view.draft?.status === closes) {
        const fresh = await request({ type: "readDraft" });
        if (fresh?.type === "result" && fresh.kind === "draft") update({ view: fresh.view });
        else report(fresh);
      }
    } else report(reply);
    update({ busy: false });
  }

  async function charge(input: TenderInput) {
    if (!canEdit()) return;
    update({ busy: true, operationError: null });
    const tender = await request({ type: "tender.add", expectedRevision: revision(), ...input });
    if (tender?.type !== "result" || tender.kind !== "draft") {
      report(tender);
      return update({ busy: false });
    }
    update({ view: tender.view });
    const reply = await request({
      type: "sale.complete",
      expectedRevision: tender.view.draft?.revision ?? 0,
    });
    finish(reply);
    update({ busy: false });
  }

  async function complete() {
    if (!canEdit()) return;
    update({ busy: true, operationError: null });
    finish(await request({ type: "sale.complete", expectedRevision: revision() }));
    update({ busy: false });
  }

  async function listHeld() {
    if (!canEdit()) return;
    update({ busy: true, operationError: null });
    const reply = await request({ type: "sale.listHeld", expectedRevision: revision() });
    if (reply?.type === "result" && reply.kind === "held") update({ held: reply.views });
    else report(reply);
    update({ busy: false });
  }

  async function holdSale(name?: string) {
    await runDraft(
      (expectedRevision) => ({ type: "sale.hold", expectedRevision, ...(name ? { name } : {}) }),
      "held",
    );
  }

  async function voidSale(reason: string, draftId?: string, expectedRevision?: number) {
    if (draftId) {
      if (!canEdit()) return;
      update({ busy: true, operationError: null });
      const reply = await request({
        type: "sale.void",
        expectedRevision: expectedRevision ?? revision(),
        reason,
        draftId,
      });
      if (
        reply?.type === "result" &&
        reply.kind === "draft" &&
        reply.view.draft?.status === "voided"
      ) {
        const held = await request({ type: "sale.listHeld", expectedRevision: revision() });
        if (held?.type === "result" && held.kind === "held") update({ held: held.views });
        else report(held);
      } else report(reply);
      update({ busy: false });
      return;
    }
    await runDraft(
      (current) => ({ type: "sale.void", expectedRevision: expectedRevision ?? current, reason }),
      "voided",
    );
  }

  async function newSale() {
    if (!canStartNewSale()) return;
    update({ receipt: null, loading: true });
    const reply = await request({ type: "readDraft" });
    if (reply?.type === "result" && reply.kind === "draft")
      update({ view: reply.view, loading: false, operationError: null });
    else {
      report(reply);
      update({ loading: false });
    }
  }

  function finish(reply: BridgeMessage | undefined) {
    if (reply?.type === "result" && reply.kind === "sale")
      return update({ receipt: reply.receipt, view: null, operationError: null });
    report(reply);
  }

  return { runDraft, charge, complete, listHeld, holdSale, voidSale, newSale };
}
