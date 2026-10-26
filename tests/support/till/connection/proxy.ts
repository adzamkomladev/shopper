import { createServer, type IncomingMessage } from "node:http";
import { once } from "node:events";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { e2eRun } from "../../../../tooling/e2e/run";

// The till-ui dev server proxies /bridge here (SHOPPER_TILL_HOST_URL in the Playwright configs).
const proxyPort = e2eRun.port(5186);
export type StatusFault =
  | "infinite-timestamp"
  | "unsafe-timestamp"
  | "infinite-protocol"
  | "empty-app-version";
type QueuedMessage = { data: RawData; binary: boolean };

export async function startBridgeProxy(targetPort: number, hold: boolean, fault?: StatusFault) {
  const server = createServer();
  const bridge = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const sockets = new Set<WebSocket>();
  const waiting = new Set<() => void>();
  let pending = hold;
  let nextHold: { resolve: () => void; release?: () => void } | undefined;
  let connections = 0;
  let failure: Error | undefined;
  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/bridge") {
      socket.destroy();
      return;
    }
    bridge.handleUpgrade(request, socket, head, (client) =>
      bridge.emit("connection", client, request),
    );
  });
  bridge.on("connection", (browser, request: IncomingMessage) => {
    connections += 1;
    sockets.add(browser);
    const messages: QueuedMessage[] = [];
    let upstream: WebSocket | undefined;
    let usedFault = false;
    const connectUpstream = () => {
      if (upstream || browser.readyState !== WebSocket.OPEN) return;
      const origin = request.headers.origin;
      upstream = new WebSocket(`ws://127.0.0.1:${targetPort}/bridge`, {
        ...(typeof origin === "string" ? { origin } : {}),
        perMessageDeflate: false,
      });
      const host = upstream;
      sockets.add(host);
      host.on("open", () => {
        for (const message of messages.splice(0))
          host.send(message.data, { binary: message.binary });
      });
      host.on("message", (data, binary) => {
        const outgoing = fault && !usedFault ? injectStatusFault(data, fault) : undefined;
        if (outgoing) usedFault = true;
        browser.send(outgoing ?? data, { binary });
      });
      host.on("error", (error) => {
        failure = error;
        browser.close();
      });
      host.on("close", () => {
        sockets.delete(host);
        browser.close();
      });
    };
    const queuedConnect = () => {
      waiting.delete(queuedConnect);
      connectUpstream();
    };
    const heldConnection = nextHold;
    if (heldConnection) {
      nextHold = undefined;
      heldConnection.release = queuedConnect;
      waiting.add(queuedConnect);
      heldConnection.resolve();
    } else if (pending) waiting.add(queuedConnect);
    else connectUpstream();
    browser.on("message", (data, binary) => {
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(data, { binary });
      else messages.push({ data, binary });
    });
    browser.on("close", () => {
      waiting.delete(queuedConnect);
      sockets.delete(browser);
      upstream?.close();
    });
    browser.on("error", (error) => {
      failure = error;
      upstream?.close();
    });
  });
  server.listen(proxyPort, "127.0.0.1");
  await once(server, "listening");
  return {
    get connections() {
      return connections;
    },
    release() {
      pending = false;
      nextHold?.release?.();
      nextHold = undefined;
      for (const connect of waiting) connect();
    },
    holdNextConnection() {
      let resolve!: () => void;
      const entered = new Promise<void>((done) => (resolve = done));
      const heldConnection: { resolve: () => void; release?: () => void } = { resolve };
      nextHold = heldConnection;
      return {
        entered,
        release() {
          if (nextHold === heldConnection) nextHold = undefined;
          heldConnection.release?.();
        },
      };
    },
    async close() {
      for (const socket of sockets) socket.terminate();
      bridge.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      if (failure) throw failure;
    },
  };
}

function injectStatusFault(data: RawData, fault: StatusFault): string | undefined {
  let raw: string;
  try {
    const bytes = Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data);
    raw = bytes.toString("utf8");
    const message: unknown = JSON.parse(raw);
    if (
      typeof message !== "object" ||
      message === null ||
      !("status" in message) ||
      typeof message.status !== "object" ||
      message.status === null ||
      !("type" in message) ||
      message.type !== "result" ||
      !("kind" in message) ||
      message.kind !== "status"
    )
      return undefined;
    const status = message.status as Record<string, unknown>;
    if (fault === "unsafe-timestamp") status.lastSuccessfulPushAt = Number.MAX_SAFE_INTEGER;
    else if (fault === "infinite-timestamp") status.lastSuccessfulPushAt = "__bridge_infinity__";
    else if (fault === "infinite-protocol") status.protocol = "__bridge_infinity__";
    else status.appVersion = "";
    const serialized = JSON.stringify(message);
    return serialized.replace('"__bridge_infinity__"', "1e309");
  } catch {
    return undefined;
  }
}
