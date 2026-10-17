import * as v from "valibot";
import { eq } from "drizzle-orm";
import { localSale } from "@shopper/db-sqlite";
import { receiptDocument } from "@shopper/core/receipts";
import { buildInfo } from "@shopper/config";
import {
  addToDraft,
  listPurchases,
  readPurchase,
  addDraftTender,
  removeDraftTender,
  setDraftDiscount,
  completeDraftSale,
  holdDraftSale,
  resumeDraftSale,
  voidDraftSale,
  listHeldDraftSales,
  hostTime,
  readDraft,
  removeDraftLine,
  setDraftQuantity,
  TillError,
  validateSession,
} from "@shopper/core/till";
import type { BridgeMessage } from "@shopper/sync/bridge";
import type { Basket, Host } from "./types";
import { error } from "./transport";

type LocalConfig = Parameters<typeof completeDraftSale>[1];

/** The signed-in cashier's basket and purchase requests. */
export function createBasket(host: Host, localConfig: LocalConfig) {
  const { database, config, payments } = host;
  const identity = config.identity;
  async function receiptFor(saleId: string) {
    const [saved] = await database.read((tx) =>
      tx.select({ receipt: localSale.receipt }).from(localSale).where(eq(localSale.id, saleId)),
    );
    if (!saved?.receipt) throw new TillError("reference", "Completed sale receipt is unavailable");
    return v.parse(receiptDocument, saved.receipt);
  }

  /** Scope and cashier come only from the host configuration, checked like a sale at corrected till time. */
  async function basket(request: Basket): Promise<BridgeMessage> {
    if (
      payments.busy &&
      !["readDraft", "sale.listHeld", "sales.list", "sales.read"].includes(request.type)
    )
      throw new TillError("DRAFT_BUSY", "Wait for the payment request to finish");
    if (!config.session)
      return error(request, "SESSION_REQUIRED", "Sign in on this register before selling");
    const deviceTime = new Date();
    const scope = await validateSession(database, config.session, {
      scope: identity,
      permission: "sale.create",
      at: deviceTime,
    });
    const at = await hostTime(database, identity, deviceTime);
    const context = {
      orgId: scope.orgId,
      actorId: scope.cashierId,
      role: config.session.roleName,
      deviceId: scope.deviceId,
      branchId: scope.branchId,
      appVersion: buildInfo.version,
    };
    const { id, type, ...input } = request;
    const edit = { ...input, scope, at };
    if (type === "sales.list")
      return { id, type: "result", kind: "purchases", ...(await listPurchases(database, edit)) };
    if (type === "sales.read")
      return { id, type: "result", kind: "purchase", purchase: await readPurchase(database, edit) };
    if (type === "sale.complete") {
      const event = await completeDraftSale(database, localConfig, config.session, {
        ...edit,
        at: deviceTime,
      });
      await host.publishStatus();
      void host.sync();
      void host.receipts.afterSale(event.sale.id);
      return { id, type: "result", kind: "sale", event, receipt: await receiptFor(event.sale.id) };
    }
    if (type === "sale.listHeld")
      return {
        id,
        type: "result",
        kind: "held",
        views: await listHeldDraftSales(database, scope, { at }),
      };
    let view;
    switch (type) {
      case "readDraft":
        view = await readDraft(database, scope, { at });
        break;
      case "add":
        view = await addToDraft(database, context, edit);
        break;
      case "setQuantity":
        view = await setDraftQuantity(database, context, edit);
        break;
      case "removeLine":
        view = await removeDraftLine(database, context, edit);
        break;
      case "tender.add":
        view = await addDraftTender(database, context, edit);
        break;
      case "tender.remove":
        view = await removeDraftTender(database, context, edit);
        break;
      case "discount.set":
        view = await setDraftDiscount(database, context, { ...edit, session: config.session });
        break;
      case "sale.hold":
        view = await holdDraftSale(database, context, edit);
        break;
      case "sale.resume":
        view = await resumeDraftSale(database, context, edit);
        break;
      case "sale.void":
        view = await voidDraftSale(database, context, { ...edit, session: config.session });
        break;
    }
    return { id, type: "result", kind: "draft", view };
  }
  return { basket, receiptFor };
}
