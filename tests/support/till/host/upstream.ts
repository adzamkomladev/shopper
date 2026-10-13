import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

type Target = { request(path: string, init?: RequestInit): Promise<Response> };
type RequestRecord = { path: string; request: unknown; response?: unknown; status?: number };
type Gate = { entered: Promise<void>; written: Promise<void>; release(): void };

export async function startHostUpstream(target: Target) {
  const requests: RequestRecord[] = [];
  let available = true;
  const releaseGates = new Set<() => void>();
  const pushWaiters = new Map<number, (request: RequestRecord) => void>();
  let nextGate:
    | { enter(): void; wait: Promise<void>; release(): void; written(): void }
    | undefined;
  const server = createServer(async (incoming, outgoing) => {
    try {
      await proxy(
        incoming,
        outgoing,
        target,
        requests,
        () => available,
        (request) =>
          pushWaiters.get(requests.filter((entry) => entry.path === "/sync/push").length)?.(
            request,
          ),
        () => {
          const gate = nextGate;
          nextGate = undefined;
          return gate;
        },
      );
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
    setAvailable(value: boolean) {
      available = value;
    },
    waitForPush(call: number, timeoutMs = 15_000) {
      const existing = requests.filter((request) => request.path === "/sync/push")[call - 1];
      if (existing) return Promise.resolve(existing);
      return new Promise<RequestRecord>((resolve, reject) => {
        const timer = setTimeout(() => {
          pushWaiters.delete(call);
          reject(new Error("No upload request reached the upstream within " + timeoutMs + "ms"));
        }, timeoutMs);
        pushWaiters.set(call, (request) => {
          clearTimeout(timer);
          resolve(request);
        });
      });
    },
    holdNextPush(): Gate {
      let enter = () => {};
      let release = () => {};
      let written = () => {};
      const entered = new Promise<void>((resolve) => {
        enter = resolve;
      });
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const responseWritten = new Promise<void>((resolve) => {
        written = resolve;
      });
      releaseGates.add(release);
      nextGate = { enter, wait, release, written };
      return { entered, written: responseWritten, release };
    },
    close() {
      for (const release of releaseGates) release();
      server.closeAllConnections();
      return new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

async function proxy(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  target: Target,
  requests: RequestRecord[],
  isAvailable: () => boolean,
  onPush: (request: RequestRecord) => void,
  gate: () => { enter(): void; wait: Promise<void>; release(): void; written(): void } | undefined,
) {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const path = incoming.url ?? "/";
  const headers = new Headers();
  for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
    const name = incoming.rawHeaders[index];
    const value = incoming.rawHeaders[index + 1];
    if (name && value) headers.append(name, value);
  }
  if (path === "/sync/push" && !isAvailable()) {
    const request = { path, request: parse(body) };
    requests.push(request);
    onPush(request);
    outgoing.destroy();
    return;
  }
  const response = await target.request(path, {
    method: incoming.method,
    headers,
    body: body.length ? body : undefined,
  });
  const record: RequestRecord = { path, request: parse(body), status: response.status };
  requests.push(record);
  const text = await response.text();
  try {
    record.response = JSON.parse(text);
  } catch {
    record.response = text;
  }
  if (path === "/sync/push") onPush(record);
  const pending = path === "/sync/push" ? gate() : undefined;
  if (pending) {
    pending.enter();
    await pending.wait;
  }
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(text);
  pending?.written();
}

function parse(body: Buffer): unknown {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    return body.toString("utf8");
  }
}
