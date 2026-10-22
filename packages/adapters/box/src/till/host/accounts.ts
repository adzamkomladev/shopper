import * as v from "valibot";
import { v7 } from "uuid";
import { buildInfo } from "@shopper/config";
import {
  addDraftAccountTender,
  hostTime,
  readDraft,
  TillError,
  validateSession,
} from "@shopper/core/till";
import { createPushTransport } from "@shopper/sync";
import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import { accountView } from "@shopper/sync/bridge";
import type { Host } from "./types";

type Request = Extract<BridgeRequest, { type: "customer.account" | "tender.account" }>;
type Refusal = { code?: string; error?: string };

/**
 * Selling on account, online only: the server answers what the customer may spend and holds credit before the
 * tender goes on the basket, under the tender's own id. Removing the tender or voiding the basket releases the
 * hold, best effort: a release that never arrives leaves the hold to lapse after an hour.
 */
export function createAccounts(host: Host) {
  const { database, config } = host;
  const { identity } = config;
  const transport = createPushTransport({
    config: {
      orgId: identity.orgId,
      deviceId: identity.deviceId,
      appVersion: buildInfo.version,
      protocol: buildInfo.syncProtocol,
      upstream: config.upstream,
      deviceToken: config.deviceToken,
    },
    timeoutMs: 15_000,
  });

  /** The server's answer; offline or failing servers are OFFLINE_UNAVAILABLE. */
  async function call(path: string, body?: unknown) {
    const result = await transport.request(path, body).catch(() => undefined);
    if (!result || result.response.status >= 500)
      throw new TillError("OFFLINE_UNAVAILABLE", "Connect to the internet to sell on account");
    return { status: result.response.status, body: JSON.parse(result.raw) as unknown };
  }

  async function account(customerId: string) {
    const reply = await call(`/sync/customers/${customerId}/account`);
    if (reply.status === 404)
      throw new TillError("CUSTOMER_UNKNOWN", "The server does not know this customer yet");
    if (reply.status !== 200)
      throw new TillError("DEVICE_REJECTED", "The server refused this register");
    return v.parse(accountView, reply.body);
  }

  async function release(holdIds: string[]) {
    const session = config.session;
    if (!session) return;
    for (const id of holdIds)
      await call(`/sync/customers/holds/${id}/release`, {
        requestId: v7(),
        proof: session.proof,
        release: { orgId: identity.orgId, sessionId: session.id },
      }).catch(() => undefined);
  }

  async function accounts(request: Request): Promise<BridgeMessage> {
    const session = config.session;
    if (!session) throw new TillError("session", "Sign in on this register first");
    const deviceTime = new Date();
    const scope = await validateSession(database, session, {
      scope: identity,
      permission: request.type === "customer.account" ? "customer.read" : "sale.create",
      at: deviceTime,
    });
    if (request.type === "customer.account")
      return {
        id: request.id,
        type: "result",
        kind: "account",
        account: await account(request.customerId),
      };
    const at = await hostTime(database, identity, deviceTime);
    const current = await readDraft(database, scope, { at });
    if ((current.draft?.revision ?? 0) !== request.expectedRevision)
      throw new TillError("REVISION_STALE", "The basket changed; try again");
    if (!current.customer)
      throw new TillError("CUSTOMER_UNKNOWN", "Attach a customer to sell on account");
    const holdId = v7();
    const held = await call("/sync/customers/holds", {
      requestId: v7(),
      proof: session.proof,
      hold: {
        id: holdId,
        orgId: identity.orgId,
        sessionId: session.id,
        customerId: current.customer.id,
        kind: request.kind,
        amount: request.amount,
      },
    });
    if (held.status !== 201) {
      const refusal = held.body as Refusal;
      if (refusal.code === "CREDIT_LIMIT" || refusal.code === "NOT_ELIGIBLE")
        throw new TillError(refusal.code, refusal.error ?? "Credit refused");
      throw new TillError("DEVICE_REJECTED", "The server refused the hold");
    }
    const context = {
      orgId: scope.orgId,
      actorId: scope.cashierId,
      role: session.roleName,
      deviceId: scope.deviceId,
      branchId: scope.branchId,
      appVersion: buildInfo.version,
    };
    let view;
    try {
      view = await addDraftAccountTender(database, context, {
        scope,
        at,
        expectedRevision: request.expectedRevision,
        id: holdId,
        kind: request.kind,
        amount: request.amount,
      });
    } catch (error) {
      await release([holdId]);
      throw error;
    }
    host.peripherals.basket(view);
    return { id: request.id, type: "result", kind: "draft", view };
  }
  return { accounts, release };
}
