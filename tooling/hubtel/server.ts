import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type Charge = { amount: number; status: "Paid" | "Unpaid" | "Failed"; transactionId: string };

/**
 * Speaks Hubtel's Receive Money and transaction status contracts on one port. A charge waits `Unpaid` until the
 * test settles it; `callback` builds the unsigned body Hubtel would POST.
 */
export async function startHubtelFake({
  port = 0,
  clientId = "hubtel_client",
  clientSecret = "hubtel_secret",
  merchantAccount = "2020000",
} = {}) {
  const charges = new Map<string, Charge>();
  const requests: Array<{ method: string; path: string; body: unknown; raw: string }> = [];
  const authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const raw = await readBody(request);
    const body = raw ? safeJson(raw) : undefined;
    requests.push({ method: request.method ?? "GET", path: url.pathname, body, raw });
    if (request.headers.authorization !== authorization)
      return reply(response, 401, { ResponseCode: "4010", Message: "Unauthorized" });
    if (
      request.method === "POST" &&
      url.pathname === `/merchantaccount/merchants/${merchantAccount}/receivemoney/mobilemoney`
    )
      return receive(response, body as Record<string, unknown> | undefined);
    if (request.method === "GET" && url.pathname === `/transactions/${merchantAccount}/status`) {
      const reference = url.searchParams.get("clientReference") ?? "";
      const found = charges.get(reference);
      if (!found) return reply(response, 404, { responseCode: "4040", message: "Not found" });
      return reply(response, 200, {
        responseCode: "0000",
        message: "Successful",
        data: {
          status: found.status,
          amount: found.amount,
          charges: 0,
          transactionId: found.transactionId,
          clientReference: reference,
        },
      });
    }
    reply(response, 404, { ResponseCode: "4040", Message: "Not found" });
  });

  function receive(response: ServerResponse, input: Record<string, unknown> | undefined) {
    const reference = typeof input?.ClientReference === "string" ? input.ClientReference : "";
    if (
      !reference ||
      typeof input?.Amount !== "number" ||
      !/^233\d{9}$/.test(String(input.CustomerMsisdn)) ||
      !["mtn-gh", "vodafone-gh", "tigo-gh"].includes(String(input.Channel))
    )
      return reply(response, 400, { ResponseCode: "4000", Message: "Validation error" });
    const transactionId = `HT${charges.size + 1}`;
    charges.set(reference, { amount: input.Amount, status: "Unpaid", transactionId });
    reply(response, 200, {
      ResponseCode: "0001",
      Message: "Transaction pending. Expect callback request for final state",
      Data: { TransactionId: transactionId, Description: "Pending payer approval" },
    });
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Hubtel fake did not bind a port");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    clientId,
    clientSecret,
    merchantAccount,
    baseUrl,
    requests,
    /** Moves a charge to its final state, as the payer approving or declining would. */
    settle(reference: string, status: "Paid" | "Failed", amount?: number) {
      const found = charges.get(reference);
      if (!found) throw new Error(`Unknown reference ${reference}`);
      found.status = status;
      if (amount !== undefined) found.amount = amount;
    },
    /** The callback body Hubtel POSTs; it may claim anything, which is why the status API decides. */
    callback(reference: string, success: boolean, amount?: number) {
      const found = charges.get(reference);
      return {
        ResponseCode: success ? "0000" : "2001",
        Message: success ? "success" : "failed",
        Data: {
          ClientReference: reference,
          TransactionId: found?.transactionId ?? null,
          Amount: amount ?? found?.amount ?? 0,
          Description: success ? "The MTN Mobile Money payment has been approved" : "Declined",
        },
      };
    },
    stop: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
