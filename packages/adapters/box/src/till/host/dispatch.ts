import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { recordLocalSale, searchCatalogue, TillError } from "@shopper/core/till";
import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import { createBasket } from "./basket";
import { createCustomers } from "./customers";
import { createRefunds } from "./refunds";
import { createShifts } from "./shifts";
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
    // Read per sale: the cashier on the receipt is whoever is signed in now.
    get receiptReference() {
      const name = host.session.current()?.name;
      return {
        orgName: identity.shopName,
        deviceName: identity.registerName,
        ...config.receiptReference,
        ...(name ? { cashierName: name } : {}),
      };
    },
  };
  const { basket, receiptFor } = createBasket(host, localConfig);
  const refunds = createRefunds(host, localConfig);
  const shifts = createShifts(host, localConfig);
  const customers = createCustomers(host);
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
        case "line.price":
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
        case "sales.lookup":
        case "refund.preview":
        case "refund.record":
          return await refunds(request);
        case "shift.open":
        case "shift.drop":
        case "shift.nosale":
        case "shift.report":
        case "shift.declare":
        case "shift.close":
        case "shift.print":
          return await shifts(request);
        case "customer.find":
        case "customer.create":
        case "customer.update":
        case "customer.attach":
          return await customers(request);
        case "approvers.list":
          return {
            id: request.id,
            type: "result",
            kind: "approvers",
            ...(await host.approvals.list(request.permission)),
          };
        case "session.signIn":
          await host.session.signIn(request.email, request.password);
          await host.publishStatus();
          break;
        case "session.signOut":
          await host.session.signOut();
          await host.publishStatus();
          break;
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
