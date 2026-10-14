import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

type FetchApp = { fetch(request: Request): Response | Promise<Response> };
export type HttpClient = {
  url: string;
  request(path: string, init?: RequestInit): Promise<Response>;
  close(): Promise<void>;
};

export async function serveHono(app: FetchApp): Promise<HttpClient> {
  const server = createServer(async (request, response) => respond(app, request, response));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    request: (path, init) => fetch(`http://127.0.0.1:${port}${path}`, init),
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function respond(app: FetchApp, incoming: IncomingMessage, outgoing: ServerResponse) {
  const headers = new Headers();
  for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
    const name = incoming.rawHeaders[index];
    const value = incoming.rawHeaders[index + 1];
    if (!name || !value) throw new Error("Malformed HTTP header pair");
    headers.append(name, value);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://${incoming.headers.host}${incoming.url}`, {
    method: incoming.method,
    headers,
    body: incoming.method === "GET" || incoming.method === "HEAD" ? undefined : body,
  });
  const result = await app.fetch(request);
  outgoing.statusCode = result.status;
  result.headers.forEach((value, name) => outgoing.setHeader(name, value));
  outgoing.end(Buffer.from(await result.arrayBuffer()));
}
