import {
  attachDraftCustomer,
  createTillCustomer,
  findCustomers,
  hostTime,
  TillError,
  updateTillCustomer,
  validateSession,
} from "@shopper/core/till";
import { buildInfo } from "@shopper/config";
import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import type { Host } from "./types";

type Request = Extract<
  BridgeRequest,
  { type: "customer.find" | "customer.create" | "customer.update" | "customer.attach" }
>;

/**
 * Customers at the till: find by phone, create and edit offline (the upload lane carries them to the server) and
 * attach to the basket. Permission is `customer.read` to look and attach, `customer.write` to create and edit.
 */
export function createCustomers(host: Host) {
  const { database, config } = host;
  const { identity } = config;

  return async function customers(request: Request): Promise<BridgeMessage> {
    const session = config.session;
    if (!session) throw new TillError("session", "Sign in on this register first");
    const deviceTime = new Date();
    const writes = request.type === "customer.create" || request.type === "customer.update";
    const scope = await validateSession(database, session, {
      scope: identity,
      permission: writes ? "customer.write" : "customer.read",
      at: deviceTime,
    });
    const at = await hostTime(database, identity, deviceTime);
    const context = {
      orgId: scope.orgId,
      actorId: scope.cashierId,
      role: session.roleName,
      deviceId: scope.deviceId,
      branchId: scope.branchId,
      appVersion: buildInfo.version,
    };
    const { id } = request;
    const { orgId, deviceId, branchId } = scope;
    const base = { scope: { orgId, deviceId, branchId }, session, at };
    const fields = Object.fromEntries(
      Object.entries(request).filter(([key]) => !["id", "type", "customerId"].includes(key)),
    );
    switch (request.type) {
      case "customer.find":
        return {
          id,
          type: "result",
          kind: "customers",
          customers: await findCustomers(database, { orgId: scope.orgId, phone: request.phone }),
        };
      case "customer.create": {
        const customer = await createTillCustomer(database, context, { ...base, customer: fields });
        void host.uploadCustomers();
        return { id, type: "result", kind: "customer", customer };
      }
      case "customer.update": {
        const customer = await updateTillCustomer(database, context, {
          ...base,
          customerId: request.customerId,
          changes: fields,
        });
        void host.uploadCustomers();
        return { id, type: "result", kind: "customer", customer };
      }
      case "customer.attach": {
        const view = await attachDraftCustomer(database, context, {
          ...base,
          scope,
          expectedRevision: request.expectedRevision,
          customerId: request.customerId,
        });
        host.peripherals.basket(view);
        return { id, type: "result", kind: "draft", view };
      }
    }
  };
}
