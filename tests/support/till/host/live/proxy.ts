import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, type WebSocketServer } from "ws";

export function proxyLiveConnection(
  incoming: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  targetUrl: string,
  available: boolean,
  bridge: WebSocketServer,
  sockets: Set<WebSocket>,
) {
  if (!available) {
    socket.write("HTTP/1.1 503 Realtime unavailable\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  const destination = new URL(incoming.url ?? "/", targetUrl);
  destination.protocol = destination.protocol === "https:" ? "wss:" : "ws:";
  const headers = Object.fromEntries(
    ["authorization", "x-shopper-device", "x-shopper-protocol"].flatMap((name) => {
      const value = incoming.headers[name];
      return value === undefined ? [] : [[name, Array.isArray(value) ? value.join(",") : value]];
    }),
  );
  const upstream = new WebSocket(destination, { headers, perMessageDeflate: false });
  sockets.add(upstream);
  upstream.once("open", () =>
    bridge.handleUpgrade(incoming, socket, head, (client) => {
      sockets.add(client);
      client.on("message", (data, binary) => upstream.send(data, { binary }));
      upstream.on("message", (data, binary) => client.send(data, { binary }));
      client.once("close", () => {
        sockets.delete(client);
        upstream.close();
      });
      upstream.once("close", () => {
        sockets.delete(upstream);
        client.close();
      });
    }),
  );
  upstream.once("unexpected-response", (_request, response) => {
    socket.write(
      `HTTP/1.1 ${response.statusCode} ${response.statusMessage ?? "Rejected"}\r\nConnection: close\r\n\r\n`,
    );
    socket.destroy();
    upstream.terminate();
  });
  upstream.once("error", () => socket.destroy());
}
