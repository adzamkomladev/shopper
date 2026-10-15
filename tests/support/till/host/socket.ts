import { v7 } from "uuid";
import WebSocket from "ws";

type Message = Record<string, unknown>;
type Ready = { port: number; capability: string; appVersion: string; protocol: number };

/** A browser-like bridge client: opens the socket with an Origin and completes the capability handshake. */
export async function connectBrowser(ready: Ready, origin = "http://127.0.0.1:5184") {
  const socket = new WebSocket(`ws://127.0.0.1:${ready.port}/bridge`, { origin });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
  const client = {
    socket,
    closed,
    /** Sends one request and resolves with the reply that carries its id; status broadcasts are skipped. */
    ask(message: Message) {
      const id = typeof message.id === "string" ? message.id : v7();
      const reply = new Promise<Message>((resolve, reject) => {
        const receive = (data: WebSocket.RawData) => {
          const parsed = JSON.parse(text(data)) as Message;
          if (parsed.id !== id) return;
          socket.off("message", receive);
          resolve(parsed);
        };
        socket.on("message", receive);
        socket.once("error", reject);
      });
      socket.send(JSON.stringify({ ...message, id }));
      return reply;
    },
    get open() {
      return socket.readyState === WebSocket.OPEN;
    },
  };
  const hello = await client.ask({
    type: "hello",
    capability: ready.capability,
    appVersion: ready.appVersion,
    protocol: ready.protocol,
  });
  if (hello.type !== "result") throw new Error(`Bridge handshake failed: ${JSON.stringify(hello)}`);
  return client;
}

function text(data: WebSocket.RawData) {
  const bytes = Buffer.isBuffer(data)
    ? data
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : Buffer.concat(data);
  return bytes.toString("utf8");
}
