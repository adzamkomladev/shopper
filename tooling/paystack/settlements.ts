import type { ServerResponse } from "node:http";

type Reply = (response: ServerResponse, status: number, body: unknown) => void;
export type FakePayout = {
  id: number;
  date: string;
  lines: Array<{ reference: string; amount: number; fees?: number }>;
};

/** Paystack's Settlements API: payouts by settlement date, and the charges each one paid out, paginated. */
export function paystackSettlements(reply: Reply) {
  const payouts: FakePayout[] = [];

  function page<T>(response: ServerResponse, url: URL, items: T[], map: (item: T) => unknown) {
    const perPage = Number(url.searchParams.get("perPage") ?? 50);
    const current = Number(url.searchParams.get("page") ?? 1);
    reply(response, 200, {
      status: true,
      message: "Settlements retrieved",
      data: items.slice((current - 1) * perPage, current * perPage).map(map),
      meta: { page: current, pageCount: Math.max(1, Math.ceil(items.length / perPage)) },
    });
  }

  return {
    /** Answers `/settlement` routes; false when the request is not one. */
    handle(method: string, url: URL, response: ServerResponse) {
      if (method !== "GET") return false;
      if (url.pathname === "/settlement") {
        const from = url.searchParams.get("from") ?? "0000-00-00";
        const to = url.searchParams.get("to") ?? "9999-99-99";
        const settled = payouts.filter((p) => p.date >= from && p.date <= to);
        page(response, url, settled, (p) => ({
          id: p.id,
          status: "success",
          currency: "GHS",
          settlement_date: `${p.date}T09:00:00.000Z`,
          total_amount: p.lines.reduce((sum, line) => sum + line.amount - (line.fees ?? 0), 0),
          total_fees: p.lines.reduce((sum, line) => sum + (line.fees ?? 0), 0),
        }));
        return true;
      }
      const match = /^\/settlement\/([^/]+)\/transactions$/.exec(url.pathname);
      if (!match) return false;
      const found = payouts.find((p) => String(p.id) === decodeURIComponent(match[1]!));
      if (!found) reply(response, 404, { status: false, message: "Settlement not found" });
      else
        page(response, url, found.lines, (line) => ({
          reference: line.reference,
          amount: line.amount,
          fees: line.fees ?? 0,
          status: "success",
          channel: "mobile_money",
        }));
      return true;
    },
    controls: {
      /** Adds a payout Paystack settled on `date`; line amounts are pesewas. */
      payout(payout: FakePayout) {
        payouts.push(payout);
      },
    },
  };
}
