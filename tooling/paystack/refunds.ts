import type { ServerResponse } from "node:http";

type Reply = (response: ServerResponse, status: number, body: unknown) => void;
type Settled = (reference: string) => { amount: number; outcome: string } | undefined;

/** Paystack's Refund API: create and fetch refunds of settled charges, and sign their `refund.*` webhooks. */
export function paystackRefunds(reply: Reply, charge: Settled, sign: (body: string) => string) {
  const refunds = new Map<string, { reference: string; amount: number; status: string }>();
  let created: "pending" | "processed" | "failed" = "pending";

  function create(response: ServerResponse, body: unknown) {
    const { transaction, amount } = body as { transaction?: string; amount?: number };
    const found = transaction ? charge(transaction) : undefined;
    if (!found || found.outcome !== "success")
      return reply(response, 400, { status: false, message: "Transaction has not been settled" });
    if (!Number.isSafeInteger(amount) || amount! <= 0 || amount! > found.amount)
      return reply(response, 400, { status: false, message: "Invalid refund amount" });
    const id = String(refunds.size + 1000);
    refunds.set(id, { reference: transaction!, amount: amount!, status: created });
    reply(response, 200, {
      status: true,
      message: "Refund has been queued for processing",
      data: { id: Number(id), status: created },
    });
  }

  function find(id: string) {
    const found = refunds.get(id);
    if (!found) throw new Error(`Unknown refund ${id}`);
    return found;
  }

  return {
    /** Answers `/refund` routes; false when the request is not one. */
    handle(method: string, path: string, body: unknown, response: ServerResponse) {
      if (method === "POST" && path === "/refund") return (create(response, body), true);
      const match = /^\/refund\/([^/]+)$/.exec(path);
      if (method !== "GET" || !match) return false;
      const found = refunds.get(decodeURIComponent(match[1]!));
      if (!found) reply(response, 404, { status: false, message: "Refund not found" });
      else
        reply(response, 200, {
          status: true,
          message: "Refund retrieved",
          data: { id: Number(match[1]), status: found.status },
        });
      return true;
    },
    controls: {
      /** What the next refund reports when it is created: Paystack usually answers `pending`. */
      refundsAre(status: "pending" | "processed" | "failed") {
        created = status;
      },
      /** Marks a refund processed or failed, as Paystack does before it sends the webhook. */
      finishRefund(id: string, status: "processed" | "failed") {
        find(id).status = status;
      },
      /** A correctly signed `refund.*` webhook body for a refund the fake created. */
      refundWebhook(id: string, event: "refund.processed" | "refund.failed") {
        const found = find(id);
        const body = JSON.stringify({
          event,
          data: {
            id: Number(id),
            transaction_reference: found.reference,
            refund_reference: `RF-${id}`,
            status: event === "refund.processed" ? "processed" : "failed",
            amount: String(found.amount),
            currency: "GHS",
          },
        });
        return { body, signature: sign(body) };
      },
    },
  };
}
