import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

/** Paystack's documented sandbox OTP; the fake accepts nothing else. */
export const FAKE_OTP = "123456";
const DECLINED =
  "Declined. Please use the test mobile money number since you are doing a test transaction.";

export type PaystackBehaviour = "success" | "send_otp" | "failed" | "pending";
type Outcome = "success" | "failed" | "pending" | "abandoned";
type Charge = { phone: string; amount: number; outcome: Outcome; behaviour: PaystackBehaviour };
export type WebhookEvent = { event: "charge.success" | "charge.failed"; reference: string };

/** Speaks the Paystack Charge contract. Phones with no configured behaviour are declined, like the sandbox. */
export async function startPaystackFake({ port = 0, secretKey = "sk_test_fake" } = {}) {
  const behaviours = new Map<string, PaystackBehaviour>();
  const charges = new Map<string, Charge>();
  const requests: Array<{ path: string; body: unknown }> = [];

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.headers.authorization !== `Bearer ${secretKey}`)
      return reply(response, 401, {
        status: false,
        message: "Invalid key",
        type: "validation_error",
        code: "invalid_Key",
      });
    const body = request.method === "POST" ? await readJson(request) : undefined;
    requests.push({ path: url.pathname, body });
    if (request.method === "POST" && url.pathname === "/charge") return charge(response, body);
    if (request.method === "POST" && url.pathname === "/charge/submit_otp")
      return submitOtp(response, body);
    const verifyMatch = /^\/transaction\/verify\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && verifyMatch) return verify(response, verifyMatch[1]!);
    reply(response, 404, { status: false, message: "Not found" });
  });

  function charge(response: ServerResponse, body: unknown) {
    const input = body as {
      reference?: string;
      amount?: number;
      currency?: string;
      mobile_money?: { phone?: string; provider?: string };
    };
    const phone = input.mobile_money?.phone;
    if (
      !input.reference ||
      !Number.isSafeInteger(input.amount) ||
      input.currency !== "GHS" ||
      !phone ||
      !["mtn", "vod", "atl"].includes(input.mobile_money?.provider ?? "")
    )
      return reply(response, 400, { status: false, message: "Invalid charge request" });
    const behaviour = behaviours.get(phone) ?? "failed";
    const outcome: Outcome = {
      success: "success",
      failed: "failed",
      pending: "pending",
      send_otp: "abandoned",
    }[behaviour] as Outcome;
    charges.set(input.reference, { phone, amount: input.amount!, outcome, behaviour });
    if (behaviour === "failed") return declined(response, input.reference);
    const status = { success: "success", send_otp: "send_otp", pending: "pay_offline" }[behaviour];
    reply(response, 200, {
      status: true,
      message: "Charge attempted",
      data: {
        reference: input.reference,
        status,
        display_text:
          status === "send_otp"
            ? "Please enter the one-time password sent to your phone"
            : undefined,
      },
    });
  }

  function submitOtp(response: ServerResponse, body: unknown) {
    const { otp, reference } = body as { otp?: string; reference?: string };
    const found = reference ? charges.get(reference) : undefined;
    if (!found || found.behaviour !== "send_otp")
      return reply(response, 400, { status: false, message: "Charge not awaiting an OTP" });
    if (otp !== FAKE_OTP)
      return reply(response, 400, {
        status: false,
        message: "The OTP provided is incorrect. Please check again",
        type: "validation_error",
        code: "invalid_otp",
      });
    found.outcome = "success";
    reply(response, 200, {
      status: true,
      message: "Charge attempted",
      data: { reference, status: "success" },
    });
  }

  function verify(response: ServerResponse, reference: string) {
    const found = charges.get(decodeURIComponent(reference));
    if (!found)
      return reply(response, 404, { status: false, message: "Transaction reference not found" });
    reply(response, 200, {
      status: true,
      message: "Verification successful",
      data: {
        reference: decodeURIComponent(reference),
        status: found.outcome,
        amount: found.amount,
        gateway_response:
          found.outcome === "failed"
            ? DECLINED
            : found.outcome === "success"
              ? "Approved"
              : "The transaction was not completed",
      },
    });
  }

  function declined(response: ServerResponse, reference: string) {
    reply(response, 400, {
      status: false,
      message: "Charge attempted",
      data: { reference, status: "failed", message: DECLINED },
      type: "api_error",
      code: "unprocessed_transaction",
    });
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Paystack fake did not bind a port");

  return {
    secretKey,
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    /** Sets how a phone number behaves when charged. */
    behave(phone: string, behaviour: PaystackBehaviour) {
      behaviours.set(phone, behaviour);
    },
    /** Resolves a charge that was left pending, so a later verify agrees with the webhook. */
    settle(reference: string, outcome: "success" | "failed") {
      const found = charges.get(reference);
      if (!found) throw new Error(`Unknown reference ${reference}`);
      found.outcome = outcome;
    },
    /** POSTs a correctly signed webhook for a known charge to `target`. */
    async deliverWebhook(target: string, { event, reference }: WebhookEvent) {
      const found = charges.get(reference);
      if (!found) throw new Error(`Unknown reference ${reference}`);
      const rawBody = JSON.stringify({
        event,
        data: {
          reference,
          status: event === "charge.success" ? "success" : "failed",
          amount: found.amount,
          channel: "mobile_money",
          currency: "GHS",
        },
      });
      return fetch(target, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-paystack-signature": signWebhook(secretKey, rawBody),
        },
        body: rawBody,
      });
    },
    stop: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

export function signWebhook(secretKey: string, rawBody: string): string {
  return createHmac("sha512", secretKey).update(rawBody).digest("hex");
}

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}
