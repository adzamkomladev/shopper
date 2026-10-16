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
  recordLocalSale,
  removeDraftLine,
  searchCatalogue,
  setDraftQuantity,
  TillError,
  validateSession,
} from "@shopper/core/till";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { BridgeMessage, BridgeRequest, HostStatus } from "@shopper/sync/bridge";
import type { HostConfiguration } from "./config";
import type { createHostPayments } from "./payments";
import { error } from "./transport";

type Basket = Extract<
  BridgeRequest,
  {
    type:
      | "readDraft"
      | "add"
      | "setQuantity"
      | "removeLine"
      | "tender.add"
      | "tender.remove"
      | "discount.set"
      | "sale.complete"
      | "sale.hold"
      | "sale.resume"
      | "sale.listHeld"
      | "sale.void"
      | "sales.list"
      | "sales.read";
  }
>;
type Host = {
  database: TillDatabase;
  config: HostConfiguration;
  status: () => Promise<HostStatus>;
  publishStatus: () => Promise<void>;
  sync: () => Promise<void>;
  close: () => void;
  payments: ReturnType<typeof createHostPayments>;
};
const storageFailed = "Register storage is unavailable. Reconnect and retry.";

/** Answers one bridge request. `trusted` is the private IPC channel; the browser socket is never trusted. */
export function createDispatch(host: Host) {
  const { database, config } = host;
  const identity = config.identity;
  const payments = host.payments;
  const localConfig = {
    ...identity,
    appVersion: buildInfo.version,
    receiptCodes: config.receiptCodes,
    receiptReference: {
      orgName: identity.shopName,
      deviceName: identity.registerName,
      ...config.receiptReference,
    },
  };
  return async function dispatch(request: BridgeRequest, trusted: boolean): Promise<BridgeMessage> {
    try {
      switch (request.type) {
        case "recordSale": {
          if (!trusted || !config.session)
            return error(
              request,
              "SESSION_REQUIRED",
              "Sign in on this register before recording sales",
            );
          const event = await recordLocalSale(database, localConfig, config.session, request.input);
          await host.publishStatus();
          void host.sync();
          return {
            id: request.id,
            type: "result",
            kind: "sale",
            event,
            receipt: await receiptFor(event.sale.id),
          };
        }
        case "payment.momo.start":
        case "payment.momo.otp":
          return {
            id: request.id,
            type: "result",
            kind: "draft",
            view: await payments.request(request),
          };
        case "search": {
          const matches = await searchCatalogue(database, {
            orgId: identity.orgId,
            query: request.query,
          });
          return { id: request.id, type: "result", kind: "search", query: request.query, matches };
        }
        case "readDraft":
        case "add":
        case "setQuantity":
        case "removeLine":
        case "tender.add":
        case "tender.remove":
        case "discount.set":
        case "sale.complete":
        case "sale.hold":
        case "sale.resume":
        case "sale.listHeld":
        case "sales.list":
        case "sales.read":
        case "sale.void":
          return await basket(request);
        case "shutdown":
          if (!trusted)
            return error(request, "FORBIDDEN", "This action requires the private till connection");
          setImmediate(host.close);
          break;
        case "retry":
          await host.sync();
      }
      return { id: request.id, type: "result", kind: "status", status: await host.status() };
    } catch (caught) {
      if (v.isValiError(caught))
        return error(request, "INVALID_INPUT", "Check the sale details and try again.");
      if (!(caught instanceof TillError)) return error(request, "STORAGE_FAILED", storageFailed);
      // Sales keep their published code; basket replies carry the TillError code the screen explains.
      const code = request.type === "recordSale" ? "SALE_REJECTED" : caught.code;
      return error(request, code, caught.message);
    }
  };

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
}
