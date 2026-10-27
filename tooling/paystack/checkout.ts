import type { ServerResponse } from "node:http";

type Reply = (response: ServerResponse, status: number, body: unknown) => void;

/** Paystack's hosted checkout: `/transaction/initialize` answers a payment page for the reference. */
export function paystackCheckout(reply: Reply) {
  return {
    /** Answers `/transaction/initialize`; false when the request is not one. */
    handle(method: string, path: string, body: unknown, response: ServerResponse) {
      if (method !== "POST" || path !== "/transaction/initialize") return false;
      const input = body as {
        reference?: string;
        amount?: number;
        currency?: string;
        email?: string;
      };
      if (
        !input.reference ||
        !Number.isSafeInteger(input.amount) ||
        input.currency !== "GHS" ||
        !input.email
      )
        reply(response, 400, { status: false, message: "Invalid checkout request" });
      else
        reply(response, 200, {
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: `https://checkout.paystack.test/${input.reference}`,
            access_code: `access-${input.reference}`,
            reference: input.reference,
          },
        });
      return true;
    },
  };
}
