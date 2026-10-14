import { buildInfo } from "@shopper/config";
import {
  addToDraft,
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
import { error } from "./transport";

type Basket = Extract<BridgeRequest, { type: "readDraft" | "add" | "setQuantity" | "removeLine" }>;
type Host = {
  database: TillDatabase;
  config: HostConfiguration;
  status: () => Promise<HostStatus>;
  publishStatus: () => Promise<void>;
  sync: () => Promise<void>;
  close: () => void;
};
const storageFailed = "Register storage is unavailable. Reconnect and retry.";

/** Answers one bridge request. `trusted` is the private IPC channel; the browser socket is never trusted. */
export function createDispatch(host: Host) {
  const { database, config } = host;
  const identity = config.identity;
  const localConfig = {
    ...identity,
    appVersion: buildInfo.version,
    receiptCodes: config.receiptCodes,
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
          return { id: request.id, type: "result", kind: "sale", event };
        }
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
      if (!(caught instanceof TillError)) return error(request, "STORAGE_FAILED", storageFailed);
      // Sales keep their published code; basket replies carry the TillError code the screen explains.
      const code = request.type === "recordSale" ? "SALE_REJECTED" : caught.code;
      return error(request, code, caught.message);
    }
  };

  /** Scope and cashier come only from the host configuration, checked like a sale at corrected till time. */
  async function basket(request: Basket): Promise<BridgeMessage> {
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
    const view =
      type === "readDraft"
        ? await readDraft(database, scope, { at })
        : type === "add"
          ? await addToDraft(database, context, edit)
          : type === "setQuantity"
            ? await setDraftQuantity(database, context, edit)
            : await removeDraftLine(database, context, edit);
    return { id, type: "result", kind: "draft", view };
  }
}
