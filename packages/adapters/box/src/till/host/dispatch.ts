import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { recordLocalSale, searchCatalogue, TillError } from "@shopper/core/till";
import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import { createBasket } from "./basket";
import type { Host } from "./types";
import { error } from "./transport";

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
  const { basket, receiptFor } = createBasket(host, localConfig);
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
        case "settings.save":
        case "printer.test":
        case "drawer.test":
        case "receipt.print":
        case "printers.list":
          return await host.devices(request);
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
}
