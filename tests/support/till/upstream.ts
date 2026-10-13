import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

export type ObservedRequest = {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  bytes: number;
  serverResponse?: unknown;
  response?: unknown;
  status?: number;
};
export type ResponseAlter = (response: Response, pushCall: number) => Response | Promise<Response>;

export async function startUpstream(
  fetchRequest: (request: Request) => Response | Promise<Response>,
  options: { alterResponse?: ResponseAlter; alterHandshake?: ResponseAlter; delayMs?: number } = {},
) {
  const requests: ObservedRequest[] = [];
  let pushCall = 0;
  const server = createServer(async (incoming, outgoing) => {
    try {
      await handle(incoming, outgoing, fetchRequest, requests, options, () => ++pushCall);
    } catch {
      if (!outgoing.destroyed) outgoing.writeHead(500).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function handle(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  fetchRequest: (request: Request) => Response | Promise<Response>,
  requests: ObservedRequest[],
  options: { alterResponse?: ResponseAlter; alterHandshake?: ResponseAlter; delayMs?: number },
  nextPushCall: () => number,
) {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks);
  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    body = raw.toString("utf8");
  }
  const entry: ObservedRequest = {
    path: new URL(incoming.url ?? "/", "http://localhost").pathname,
    headers: incoming.headers,
    body,
    bytes: raw.byteLength,
  };
  requests.push(entry);
  const headers = new Headers();
  for (const name of ["authorization", "x-shopper-device", "x-shopper-org", "content-type"])
    if (incoming.headers[name]) headers.set(name, String(incoming.headers[name]));
  const response = await fetchRequest(
    new Request(`http://localhost${entry.path}`, {
      method: incoming.method,
      headers,
      body: raw.byteLength ? raw : undefined,
    }),
  );
  if (entry.path === "/sync/push") {
    const realText = await response.clone().text();
    try {
      entry.serverResponse = JSON.parse(realText);
    } catch {
      entry.serverResponse = realText;
    }
  }
  const altered =
    entry.path === "/sync/handshake" && options.alterHandshake
      ? await options.alterHandshake(response, 0)
      : entry.path === "/sync/push" && options.alterResponse
        ? await options.alterResponse(response, nextPushCall())
        : response;
  if (entry.path === "/sync/push" && !options.alterResponse) nextPushCall();
  const text = await altered.text();
  entry.status = altered.status;
  try {
    entry.response = JSON.parse(text);
  } catch {
    entry.response = text;
  }
  if (entry.path === "/sync/push" && options.delayMs)
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));
  if (outgoing.destroyed) return;
  outgoing.writeHead(altered.status, Object.fromEntries(altered.headers.entries()));
  outgoing.end(text);
}
