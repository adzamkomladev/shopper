import { createHash } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";

export type SdcArrival = { invoiceNumber: string; payload: unknown };
type Signed = { sdcId: string; counter: number; signature: string; qr: string; signedAt: string };

/**
 * Speaks the mock GRA E-VAT SDC contract: POST /api/v1/invoices with an `x-api-key` header answers 200 with a
 * signature or 422 with a rejection. A repeated invoice number gets its first answer again. The `/test/*` routes let
 * a test in another process (a Worker) steer it and read what arrived.
 */
export async function startSdcFake({
  port = 0,
  apiKey = "sdc_fake_key",
  sdcId = "SDC-TEST-01",
} = {}) {
  /** Every submission that reached the SDC, oldest first, including failed and repeated ones. */
  const arrivals: SdcArrival[] = [];
  const signed = new Map<string, Signed>();
  const rejections = new Map<string, { code: string; message: string }>();
  let down = false;
  let failures = 0;
  const control = {
    down: () => void (down = true),
    up: () => void (down = false),
    /** The next `count` submissions reach the SDC and fail with a 503. */
    failNext: (count: number) => void (failures = count),
    reject: (invoiceNumber: string, code = "E_TIN", message = "Buyer TIN is not registered") =>
      void rejections.set(invoiceNumber, { code, message }),
    reset() {
      arrivals.length = 0;
      signed.clear();
      rejections.clear();
      down = false;
      failures = 0;
    },
  };
  const server = createServer(async (request, response) => {
    const reply = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (request.method === "GET" && request.url === "/test/arrivals") return reply(200, arrivals);
    if (request.method === "POST" && request.url === "/test/control") {
      const body = (await readJson(request)) as {
        action: "down" | "up" | "reset" | "failNext" | "reject";
        count?: number;
        invoiceNumber?: string;
      };
      if (body.action === "failNext") control.failNext(body.count ?? 1);
      else if (body.action === "reject") control.reject(body.invoiceNumber ?? "");
      else control[body.action]();
      return reply(200, { ok: true });
    }
    // Down means unreachable: the socket closes without an answer, as a dead network would.
    if (down) return request.socket.destroy();
    if (request.method !== "POST" || request.url !== "/api/v1/invoices")
      return reply(404, { status: "error", message: "Not found" });
    if (request.headers["x-api-key"] !== apiKey)
      return reply(401, { status: "error", message: "Invalid API key" });
    const body = (await readJson(request)) as Partial<SdcArrival>;
    if (!body.invoiceNumber || !body.payload)
      return reply(400, { status: "error", message: "Missing invoiceNumber or payload" });
    arrivals.push({ invoiceNumber: body.invoiceNumber, payload: body.payload });
    if (failures > 0) {
      failures -= 1;
      return reply(503, { status: "error", message: "Temporarily unavailable" });
    }
    const rejection = rejections.get(body.invoiceNumber);
    if (rejection) return reply(422, { status: "rejected", ...rejection });
    const known = signed.get(body.invoiceNumber);
    if (known) return reply(200, { status: "accepted", ...known });
    const counter = signed.size + 1;
    const signature = createHash("sha256")
      .update(`${sdcId}|${counter}|${body.invoiceNumber}`)
      .digest("hex")
      .slice(0, 32)
      .toUpperCase();
    const result = {
      sdcId,
      counter,
      signature,
      qr: `https://evat.example.test/verify?sdc=${sdcId}&n=${counter}&s=${signature}`,
      signedAt: new Date().toISOString(),
    };
    signed.set(body.invoiceNumber, result);
    reply(200, { status: "accepted", ...result });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SDC fake did not bind a port");
  return {
    apiKey,
    sdcId,
    url: `http://127.0.0.1:${address.port}`,
    arrivals,
    ...control,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
