import type { ServerResponse } from "node:http";

type Reply = (response: ServerResponse, status: number, body: unknown) => void;

/** Paystack's GHS settlement banks and mobile money, as `GET /bank?currency=GHS` lists them (a sample). */
export const GHS_BANKS = [
  { name: "GCB Bank Limited", code: "040", type: "ghipss" },
  { name: "Ecobank Ghana Limited", code: "130", type: "ghipss" },
  { name: "MTN Mobile Money", code: "MTN", type: "mobile_money" },
  { name: "Telecel Cash", code: "VOD", type: "mobile_money" },
];

/** `GET /bank` and `POST /subaccount`: every subaccount made is kept, so a test can count them. */
export function paystackSubaccounts(reply: Reply) {
  const made: Array<{ code: string; body: Record<string, unknown> }> = [];
  return {
    handle(method: string, url: URL, body: unknown, response: ServerResponse) {
      if (method === "GET" && url.pathname === "/bank") {
        reply(response, 200, {
          status: true,
          message: "Banks retrieved",
          data: url.searchParams.get("currency") === "GHS" ? GHS_BANKS : [],
          meta: { page: 1, pageCount: 1 },
        });
        return true;
      }
      if (method !== "POST" || url.pathname !== "/subaccount") return false;
      const input = (body ?? {}) as Record<string, unknown>;
      if (
        typeof input.business_name !== "string" ||
        !GHS_BANKS.some((bank) => bank.code === input.settlement_bank) ||
        typeof input.account_number !== "string" ||
        typeof input.percentage_charge !== "number"
      ) {
        reply(response, 400, { status: false, message: "Invalid subaccount request" });
        return true;
      }
      const code = `ACCT_fake${made.length + 1}`;
      made.push({ code, body: input });
      reply(response, 200, {
        status: true,
        message: "Subaccount created",
        data: { subaccount_code: code, business_name: input.business_name },
      });
      return true;
    },
    controls: { subaccounts: made },
  };
}
