import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { proxyLiveConnection } from "./live/proxy";

type Target = { url: string; request(path: string, init?: RequestInit): Promise<Response> };
type RequestRecord = { path: string; request: unknown; response?: unknown; status?: number };
type Gate = { entered: Promise<void>; written: Promise<void>; release(): void };

export async function startHostUpstream(target: Target) {
  const requests: RequestRecord[] = [];
  const sockets = new Set<WebSocket>();
  const bridge = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  let available = true;
  let pullAvailable = true;
  let liveAvailable = true;
  const faults = { dropRefundResponse: false };
  const releaseGates = new Set<() => void>();
  const pushWaiters = new Map<number, (request: RequestRecord) => void>();
  const pullWaiters = new Map<number, (request: RequestRecord) => void>();
  let nextPushGate: GateState | undefined;
  let nextPullGate: GateState | undefined;
  const server = createServer(async (incoming, outgoing) => {
    try {
      await proxy(
        incoming,
        outgoing,
        target,
        requests,
        () => available,
        () => pullAvailable,
        (request) => pushWaiters.get(countPath(requests, "/sync/push"))?.(request),
        (request) => pullWaiters.get(countPulls(requests))?.(request),
        () => takeGate("push"),
        () => takeGate("pull"),
        faults,
      );
    } catch {
      if (!outgoing.destroyed) outgoing.writeHead(500).end();
    }
  });
  server.on("upgrade", (incoming, socket, head) => {
    proxyLiveConnection(incoming, socket, head, target.url, liveAvailable, bridge, sockets);
  });

  function takeGate(kind: "push" | "pull") {
    const gate = kind === "push" ? nextPushGate : nextPullGate;
    if (kind === "push") nextPushGate = undefined;
    else nextPullGate = undefined;
    return gate;
  }

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    setAvailable(value: boolean) {
      available = value;
    },
    setPullAvailable(value: boolean) {
      pullAvailable = value;
    },
    /** The server handles the next refund upload, then the connection dies before the reply arrives. */
    dropNextRefundResponse() {
      faults.dropRefundResponse = true;
    },
    setLiveAvailable(value: boolean) {
      liveAvailable = value;
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
    pullRequestCount: () => countPulls(requests),
    waitForPull(call: number, timeoutMs = 15_000) {
      const existing = requests.filter(isPullRequest)[call - 1];
      if (existing) return Promise.resolve(existing);
      return waitForRequest(pullWaiters, call, "No pull request reached the upstream", timeoutMs);
    },
    holdNextPush(): Gate {
      const gate = createGate(releaseGates);
      nextPushGate = gate.state;
      return gate.result;
    },
    holdNextPull(): Gate {
      const gate = createGate(releaseGates);
      nextPullGate = gate.state;
      return gate.result;
    },
    close() {
      for (const release of releaseGates) release();
      for (const socket of sockets) socket.terminate();
      bridge.close();
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
  isPullAvailable: () => boolean,
  onPush: (request: RequestRecord) => void,
  onPull: (request: RequestRecord) => void,
  pushGate: () => GateState | undefined,
  pullGate: () => GateState | undefined,
  faults: { dropRefundResponse: boolean },
) {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const path = incoming.url ?? "/";
  const pathname = new URL(path, "http://localhost").pathname;
  const headers = new Headers();
  for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
    const name = incoming.rawHeaders[index];
    const value = incoming.rawHeaders[index + 1];
    if (name && value) headers.append(name, value);
  }
  // Offline, pushes and the online-only account reads and holds lose their connection.
  if ((path === "/sync/push" || pathname.startsWith("/sync/customers/")) && !isAvailable()) {
    const request = { path, request: parse(body) };
    requests.push(request);
    if (path === "/sync/push") onPush(request);
    outgoing.destroy();
    return;
  }
  if (isPullPath(pathname) && !isPullAvailable()) {
    const record = { path, request: parse(body), status: 503 };
    requests.push(record);
    onPull(record);
    outgoing.writeHead(503).end();
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
  if (pathname === "/sync/refunds" && faults.dropRefundResponse) {
    faults.dropRefundResponse = false;
    outgoing.destroy();
    return;
  }
  if (pathname === "/sync/push") onPush(record);
  if (isPullPath(pathname)) onPull(record);
  const pending =
    pathname === "/sync/push" ? pushGate() : isPullPath(pathname) ? pullGate() : undefined;
  if (pending) {
    pending.enter();
    await pending.wait;
  }
  const responseHeaders = Object.fromEntries(
    [...response.headers].filter(
      ([name]) => name !== "content-encoding" && name !== "content-length",
    ),
  );
  outgoing.writeHead(response.status, responseHeaders);
  outgoing.end(text);
  pending?.written();
}

type GateState = { enter(): void; wait: Promise<void>; release(): void; written(): void };

function createGate(releaseGates: Set<() => void>) {
  let enter = () => {};
  let release = () => {};
  let written = () => {};
  const entered = new Promise<void>((resolve) => (enter = resolve));
  const wait = new Promise<void>((resolve) => (release = resolve));
  const responseWritten = new Promise<void>((resolve) => (written = resolve));
  releaseGates.add(release);
  return {
    state: { enter, wait, release, written },
    result: { entered, written: responseWritten, release },
  };
}

function waitForRequest(
  waiters: Map<number, (request: RequestRecord) => void>,
  call: number,
  error: string,
  timeoutMs: number,
) {
  return new Promise<RequestRecord>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(call);
      reject(new Error(`${error} within ${timeoutMs}ms`));
    }, timeoutMs);
    waiters.set(call, (request) => {
      clearTimeout(timer);
      resolve(request);
    });
  });
}

function isPullRequest(request: RequestRecord) {
  return isPullPath(new URL(request.path, "http://localhost").pathname);
}

function isPullPath(path: string) {
  return path === "/sync/changes" || path === "/sync/snapshot" || path === "/sync/status";
}

function countPath(requests: RequestRecord[], path: string) {
  return requests.filter((request) => new URL(request.path, "http://localhost").pathname === path)
    .length;
}

function countPulls(requests: RequestRecord[]) {
  return requests.filter(isPullRequest).length;
}

function parse(body: Buffer): unknown {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    return body.toString("utf8");
  }
}
