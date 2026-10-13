import { createServer, type IncomingMessage } from "node:http";
import * as v from "valibot";

const emailSchema = v.strictObject({
  from: v.strictObject({ address: v.pipe(v.string(), v.email()), display_name: v.string() }),
  to: v.strictObject({ address: v.pipe(v.string(), v.email()) }),
  subject: v.string(),
  plain: v.string(),
  tracking: v.literal(false),
});
export type MailerooEmail = v.InferOutput<typeof emailSchema>;

export async function mailerooFixture(port = 0) {
  const apiKey = "local-maileroo-contract-key";
  const requests: MailerooEmail[] = [];
  const responses: Array<{ status: number; body: unknown }> = [];
  let heldResponse:
    | {
        receive: (email: MailerooEmail) => void;
        released: Promise<void>;
      }
    | undefined;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/messages") {
      const email = url.searchParams.get("email");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify(requests.filter((message) => !email || message.to.address === email)),
      );
      return;
    }
    if (request.method === "POST" && url.pathname === "/failures") {
      try {
        const { count } = v.parse(
          v.strictObject({
            count: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)),
          }),
          await readJson(request),
        );
        responses.push(
          ...Array.from({ length: count }, () => ({ status: 500, body: { success: false } })),
        );
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ queued: responses.length }));
      } catch {
        response.writeHead(400).end();
      }
      return;
    }
    if (request.method !== "POST" || request.url !== "/api/v2/emails") {
      response.writeHead(404).end();
      return;
    }
    if (request.headers.authorization !== `Bearer ${apiKey}`) {
      response.writeHead(401).end();
      return;
    }
    let email: MailerooEmail;
    try {
      email = v.parse(emailSchema, await readJson(request));
    } catch {
      response.writeHead(400).end();
      return;
    }
    requests.push(email);
    const held = heldResponse;
    heldResponse = undefined;
    if (held) {
      held.receive(email);
      await held.released;
    }
    const reply = responses.shift() ?? {
      status: 200,
      body: { success: true, data: { reference_id: crypto.randomUUID() } },
    };
    response.writeHead(reply.status, { "content-type": "application/json" });
    response.end(JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Maileroo did not bind a port");
  return {
    apiKey,
    endpoint: `http://127.0.0.1:${address.port}/api/v2/emails`,
    requests,
    responses,
    holdNext() {
      if (heldResponse) throw new Error("A Maileroo response is already held");
      let receive: (email: MailerooEmail) => void;
      let release: () => void;
      const received = new Promise<MailerooEmail>((resolve) => {
        receive = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      heldResponse = { receive: (email) => receive(email), released };
      return { received, release: () => release() };
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
