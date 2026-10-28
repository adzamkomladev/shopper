import * as v from "valibot";
import { v7 } from "uuid";
import { buildInfo } from "@shopper/config";
import {
  addDraftAccountTender,
  hostTime,
  readDraft,
  recordAccountPayment,
  TillError,
  validateSession,
} from "@shopper/core/till";
import { createPushTransport, sessionCredential } from "@shopper/sync";
import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import { accountView, pointsHoldReply } from "@shopper/sync/bridge";
import type { Host } from "./types";

type Request = Extract<
  BridgeRequest,
  { type: "customer.account" | "tender.account" | "account.payment" }
>;
type Refusal = { code?: string; error?: string };

/**
 * Account payments at the drawer take cash anywhere and MoMo only online. Selling on account, online only: the server answers what the customer may spend and holds credit before the
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

  async function account(customerId: string, session: NonNullable<typeof config.session>) {
    const reply = await call(`/sync/customers/${customerId}/account`, {
      ...sessionCredential(session),
      session: { orgId: identity.orgId, sessionId: session.id },
    });
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
        ...sessionCredential(session),
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
        account: await account(request.customerId, session),
      };
    const at = await hostTime(database, identity, deviceTime);
    if (request.type === "account.payment") return payment(request, scope, session, at);
    const current = await readDraft(database, scope, { at });
    if ((current.draft?.revision ?? 0) !== request.expectedRevision)
      throw new TillError("REVISION_STALE", "The basket changed; try again");
    if (!current.customer)
      throw new TillError("CUSTOMER_UNKNOWN", "Attach a customer to sell on account");
    // Credit tenders an amount, points whole points; the other is never taken from the request.
    const size =
      request.kind === "loyalty" ? { points: request.points } : { amount: request.amount };
    if (Object.values(size)[0] === undefined)
      throw new TillError("AMOUNT_INVALID", `A ${request.kind} tender needs its size`);
    const holdId = v7();
    const held = await call("/sync/customers/holds", {
      requestId: v7(),
      ...sessionCredential(session),
      hold: {
        id: holdId,
        orgId: identity.orgId,
        sessionId: session.id,
        customerId: current.customer.id,
        kind: request.kind,
        ...size,
      },
    });
    if (held.status !== 201) {
      const refusal = held.body as Refusal;
      if (
        refusal.code === "CREDIT_LIMIT" ||
        refusal.code === "NOT_ELIGIBLE" ||
        refusal.code === "POINTS_SHORT" ||
        refusal.code === "LOYALTY_OFF"
      )
        throw new TillError(refusal.code, refusal.error ?? "Account tender refused");
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
        ...(request.kind === "loyalty"
          ? {
              kind: request.kind,
              points: request.points,
              amount: v.parse(pointsHoldReply, held.body).hold.value,
            }
          : { kind: request.kind, amount: request.amount }),
      });
    } catch (error) {
      await release([holdId]);
      throw error;
    }
    host.peripherals.basket(view);
    return { id: request.id, type: "result", kind: "draft", view };
  }

  /**
   * Cash or MoMo paid onto an account at the drawer. Cash is kept even offline, since it can only lower what is
   * owed; MoMo needs the network, which also proves the server knows the customer. The slip prints after the commit.
   */
  async function payment(
    request: Extract<Request, { type: "account.payment" }>,
    scope: { orgId: string; deviceId: string; branchId: string; cashierId: string },
    session: NonNullable<typeof config.session>,
    at: Date,
  ): Promise<BridgeMessage> {
    if (request.method === "momo") await account(request.customerId, session);
    const { orgId, deviceId, branchId, cashierId } = scope;
    const made = await recordAccountPayment(
      database,
      {
        orgId,
        actorId: cashierId,
        role: session.roleName,
        deviceId,
        branchId,
        appVersion: buildInfo.version,
      },
      {
        scope: { orgId, deviceId, branchId },
        session,
        at,
        customerId: request.customerId,
        method: request.method,
        amount: request.amount,
        reference: request.reference ?? null,
      },
    );
    void host.uploadAccountPayments();
    const printed = await host.receipts
      .printAccountPayment({
        shopName: identity.shopName,
        registerName: identity.registerName,
        customerName: made.customerName,
        method: made.method,
        amount: made.amount,
        reference: made.reference,
        // Accra is UTC all year.
        at: made.at.slice(0, 16).replace("T", " "),
        cashierName: host.session.current()?.name ?? "Cashier",
      })
      .then(
        () => true,
        () => false,
      );
    return {
      id: request.id,
      type: "result",
      kind: "accountPayment",
      payment: {
        id: made.id,
        customerId: made.customerId,
        shiftId: made.shiftId,
        method: made.method,
        amount: made.amount,
        reference: made.reference,
      },
      printed,
    };
  }
  return { accounts, release };
}
