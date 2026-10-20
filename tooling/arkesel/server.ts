import { createServer, type IncomingMessage } from "node:http";

export type ArkeselRequest = { sender: string; message: string; recipients: string[] };

/** Speaks the Arkesel v2 send contract: an `api-key` header, then `{status: "success", data}`. */
export async function startArkeselFake({ port = 0, apiKey = "arkesel_fake_key" } = {}) {
  const requests: ArkeselRequest[] = [];
  let failures = 0;
  const server = createServer(async (request, response) => {
    const reply = (status: number, body: object) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    // Lets a test in another process (a Worker) read what was accepted.
    if (request.method === "GET" && request.url === "/test/requests") return reply(200, requests);
    if (request.method !== "POST" || request.url !== "/api/v2/sms/send")
      return reply(404, { status: "error", message: "Not found" });
    if (request.headers["api-key"] !== apiKey)
      return reply(401, { status: "error", message: "Invalid API key" });
    const body = (await readJson(request)) as Partial<ArkeselRequest>;
    if (failures > 0) {
      failures -= 1;
      return reply(503, { status: "error", message: "Temporarily unavailable" });
    }
    if (!body.sender || !body.message || !body.recipients?.length)
      return reply(400, { status: "error", message: "Missing sender, message or recipients" });
    requests.push(body as ArkeselRequest);
    reply(200, {
      status: "success",
      data: body.recipients.map((recipient, index) => ({
        recipient,
        id: `fake-${requests.length}-${index}`,
      })),
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Arkesel fake did not bind a port");
  return {
    apiKey,
    baseUrl: `http://127.0.0.1:${address.port}`,
    /** Every accepted send, oldest first. */
    requests,
    /** The next `count` sends fail with a 503. */
    failNext(count: number) {
      failures = count;
    },
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
