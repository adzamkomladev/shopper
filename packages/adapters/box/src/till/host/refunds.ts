import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { serverSale, type ServerSale } from "@shopper/core/schemas";
import {
  findSaleByReceipt,
  hostTime,
  planRefund,
  reserveCreditNote,
  readPurchase,
  readRefundEligibility,
  recordRefund,
  serverPurchase,
  TillError,
} from "@shopper/core/till";
import { createPushTransport, documentOutcome } from "@shopper/sync";
import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import type { Host } from "./types";

type Request = Extract<
  BridgeRequest,
  { type: "sales.lookup" | "refund.preview" | "refund.record" }
>;
type Recording = Extract<Request, { type: "refund.record" }>;
type ReplayAttempt = Pick<Recording, "lines" | "reason" | "tender"> & {
  at: Date;
  saleId: string;
  original: ServerSale | undefined;
  approverId: string | undefined;
  id?: string;
  lineIds?: string[];
  creditNoteNumber?: string;
};
type LocalConfig = Parameters<typeof recordRefund>[1];

/** Refunds on this register: its own sales offline, other registers' sales through the server. */
export function createRefunds(host: Host, localConfig: LocalConfig) {
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
  const attempts = new Map<string, ReplayAttempt>();
  const offline = () =>
    new TillError(
      "OFFLINE_UNAVAILABLE",
      "Connect to the internet to refund a sale from another register",
    );

  /** The server's record of a sale of this store; undefined when it has none; throws when it cannot be asked. */
  async function lookupServer(receipt: string): Promise<ServerSale | undefined> {
    const result = await transport
      .request(`/sync/sales/lookup?receipt=${encodeURIComponent(receipt)}`)
      .catch(() => undefined);
    if (!result || result.response.status >= 500) throw offline();
    if (result.response.status === 404) return undefined;
    if (!result.response.ok)
      throw new TillError("DEVICE_REJECTED", "The server refused this register");
    return v.parse(serverSale, JSON.parse(result.raw));
  }

  /** This register's own sale when it has one, else the server's; a fresh lookup every time. */
  async function resolve(target: { saleId?: string; receipt?: string }) {
    if (target.saleId) return { saleId: target.saleId, original: undefined };
    const receipt = target.receipt ?? "";
    const local = await findSaleByReceipt(database, identity, receipt);
    if (local) return { saleId: local, original: undefined };
    const original = await lookupServer(receipt);
    if (!original)
      throw new TillError("SALE_UNKNOWN", `No sale with receipt ${receipt} in this store`);
    return { saleId: original.sale.id, original };
  }

  async function post(event: Awaited<ReturnType<typeof planRefund>>["event"], proof: string) {
    const result = await transport
      .request("/sync/refunds", { requestId: event.refund.id, proof, refund: event })
      .catch(() => undefined);
    if (!result || result.response.status >= 500) throw offline();
    if (!result.response.ok)
      throw new TillError("DEVICE_REJECTED", "The server refused this register");
    const outcome = v.parse(documentOutcome, JSON.parse(result.raw));
    if (outcome.rejected)
      throw new TillError(outcome.rejected.code as TillError["code"], outcome.rejected.message);
    if (!outcome.accepted) throw offline();
  }

  return async function refunds(request: Request): Promise<BridgeMessage> {
    const { session } = config;
    if (!session)
      return {
        type: "error",
        id: request.id,
        code: "SESSION_REQUIRED",
        message: "Sign in on this register first",
      };
    const at = new Date();
    const scope = { ...identity, cashierId: session.userId };
    if (request.type === "sales.lookup") {
      const local = await findSaleByReceipt(database, identity, request.receipt);
      const reply = { id: request.id, type: "result" as const, kind: "saleLookup" as const };
      if (local)
        return {
          ...reply,
          status: "found",
          purchase: await readPurchase(database, {
            scope,
            at: await hostTime(database, identity, at),
            saleId: local,
          }),
        };
      try {
        const original = await lookupServer(request.receipt);
        if (!original) return { ...reply, status: "missing", purchase: null };
        const eligibility = await readRefundEligibility(database, localConfig, {
          at,
          saleId: original.sale.id,
          original,
        });
        return { ...reply, status: "found", purchase: serverPurchase(original, eligibility) };
      } catch (error) {
        if (error instanceof TillError && error.code === "OFFLINE_UNAVAILABLE")
          return { ...reply, status: "offline", purchase: null };
        throw error;
      }
    }
    const retry =
      request.type === "refund.record" ? attempts.get(request.refundId ?? "") : undefined;
    const { saleId, original } = retry ?? (await resolve(request));
    if (request.type === "refund.preview")
      return {
        id: request.id,
        type: "result",
        kind: "refundPreview",
        eligibility: await readRefundEligibility(database, localConfig, { at, saleId, original }),
      };
    const input = retry ?? {
      at,
      saleId,
      original,
      lines: request.lines,
      reason: request.reason,
      tender: request.tender,
      approverId: await host.approvals.verify(request.approval, "refund.approve"),
      id: request.refundId,
    };
    let recorded;
    if (original) {
      // The drawer opens only for a refund the server has accepted.
      const numbered = {
        ...input,
        creditNoteNumber:
          input.creditNoteNumber ?? (await reserveCreditNote(database, localConfig, session)),
      };
      const { event } = await planRefund(database, localConfig, session, numbered);
      const fixed = {
        ...numbered,
        id: event.refund.id,
        lineIds: event.refund.lines.map((l) => l.id),
      };
      try {
        await post(event, session.proof);
      } catch (error) {
        // The reply may be lost after the server accepted: a retry must send the identical event, and the
        // server's count already includes it, so it is replanned from this attempt's own sale view and time.
        // ponytail: in memory, so a host restart forgets it and the retry is refused as over-refunding.
        if (request.refundId && error instanceof TillError && error.code === "OFFLINE_UNAVAILABLE")
          attempts.set(request.refundId, fixed);
        else attempts.delete(request.refundId ?? "");
        throw error;
      }
      attempts.delete(request.refundId ?? "");
      recorded = await recordRefund(database, localConfig, session, {
        ...fixed,
        acceptedAt: new Date(),
      });
    } else recorded = await recordRefund(database, localConfig, session, input);
    await host.publishStatus();
    void host.receipts.afterDocument(recorded.event.refund.id, { sale: false });
    void host.uploadRefunds();
    return {
      id: request.id,
      type: "result",
      kind: "refund",
      origin: recorded.origin,
      refund: recorded.event.refund,
      receipt: recorded.receipt,
    };
  };
}
