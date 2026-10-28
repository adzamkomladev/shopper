import { sql } from "drizzle-orm";
import * as v from "valibot";
import { verifyPin } from "@shopper/auth/devices";
import { approve, hostTime, readApprovers, TillError } from "@shopper/core/till";
import { refund, type TillDatabase } from "@shopper/db-sqlite";
import type { Approval, RemoteApprovalView } from "@shopper/sync/bridge";
import type { HostConfiguration } from "./config";
import { auditContext } from "./context";
import { paymentHeaders } from "./payments/headers";
import { serverApproval } from "./schemas/approvals";

/**
 * Manager approvals on this register: the host checks a PIN, or checks a back-office answer with the server, so
 * only a verified approver id reaches core. Answers pushed through the store's live socket are kept for the UI.
 */
export function createApprovals(host: { database: TillDatabase; config: HostConfiguration }) {
  const { database, config } = host;
  const { identity } = config;
  const answers = new Map<string, v.InferOutput<typeof serverApproval>>();

  async function call(path: string, body?: object) {
    if (!config.session) throw new TillError("session", "Sign in on this register first");
    const response = await fetch(new URL(path, config.upstream), {
      method: body ? "POST" : "GET",
      headers: await paymentHeaders(config),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
    const parsed =
      response?.ok && v.safeParse(serverApproval, await response.json().catch(() => undefined));
    if (!parsed || !parsed.success)
      throw new TillError("APPROVAL_OFFLINE", "Connect to the internet to ask a manager remotely");
    return parsed.output;
  }
  /** The latest answer: a pushed final answer when there is one, else the server's. */
  async function status(approvalId: string) {
    const pushed = answers.get(approvalId);
    return pushed && pushed.status !== "pending" ? pushed : call(`/approvals/${approvalId}`);
  }
  const view = (row: v.InferOutput<typeof serverApproval>): RemoteApprovalView => ({
    id: row.id,
    status: row.status,
    expiresAt: row.expiresAt,
    declineReason: row.declineReason,
  });

  return {
    /** Who could approve `permission`, as names and ids only. */
    async list(permission: string) {
      if (!config.session) throw new TillError("session", "Sign in on this register first");
      const at = await hostTime(database, identity, new Date());
      return readApprovers(database, identity.orgId, permission, at);
    },
    async request(input: {
      saleId: string;
      receiptNumber?: string;
      amount: number;
      reason: string;
    }) {
      return view(
        await call("/approvals", {
          kind: "refund",
          saleId: input.saleId,
          receiptNumber: input.receiptNumber,
          amount: input.amount,
          reason: input.reason,
        }),
      );
    },
    status: async (approvalId: string) => view(await status(approvalId)),
    /** A pushed `approval.decided` for this register. */
    async receive(payload: unknown) {
      const parsed = v.safeParse(serverApproval, payload);
      if (parsed.success && parsed.output.deviceId === identity.deviceId)
        answers.set(parsed.output.id, parsed.output);
    },
    /**
     * A back-office approval for a refund of `saleId`, checked with the server now rather than from a pushed answer:
     * approved, unused there and by any refund on this register. The caller still matches the refund total.
     */
    async remote(approvalId: string, saleId: string) {
      const answer = await call(`/approvals/${approvalId}`);
      const [used] = await database.read((tx) =>
        tx
          .select({ id: refund.id })
          .from(refund)
          .where(sql`json_extract(${refund.payload}, '$.refund.approvalId') = ${approvalId}`),
      );
      if (
        answer.status !== "approved" ||
        answer.kind !== "refund" ||
        answer.subject.saleId !== saleId
      )
        throw new TillError("APPROVAL_FORBIDDEN", "The manager has not approved this refund");
      if (answer.consumed || used)
        throw new TillError("APPROVAL_FORBIDDEN", "This approval was already used. Ask again.");
      return { approverId: answer.decidedBy!, amount: answer.subject.amount };
    },
    /** The approver a manager's PIN verifies, or undefined when the request carries no approval. */
    async verify(approval: Approval | undefined, permission: string) {
      if (!approval) return undefined;
      if (!config.session) throw new TillError("session", "Sign in on this register first");
      if ("approvalId" in approval)
        throw new TillError("APPROVAL_FORBIDDEN", "Ask the manager for their PIN here");
      const at = await hostTime(database, identity, new Date());
      return approve(
        database,
        auditContext(config),
        { approverId: approval.approverId.toLowerCase(), pin: approval.pin, permission, at },
        verifyPin,
      );
    },
  };
}
