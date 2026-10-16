import type { LiveSocket, LiveMode } from "./types";
export type { LiveSocket, LiveMode } from "./types";
import { paymentNudge, nudge } from "./schemas/live";
import * as v from "valibot";

const FALLBACK_MS = 30_000;
const MAX_FALLBACK_MS = 300_000;

export function createLiveWorker(options: {
  config: { upstream: string; deviceId: string; deviceToken: string };
  cursor: () => string;
  trigger: () => Promise<void>;
  connect: (url: string, headers: Record<string, string>) => LiveSocket;
  onMode?: (mode: LiveMode) => void;
  onPayment?: (payment: v.InferOutput<typeof paymentNudge>["payload"]) => Promise<void>;
  onConnected?: () => Promise<void>;
}) {
  let socket: LiveSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let catchupTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;
  let attempt = 0;
  let mode: LiveMode = "offline";
  let pulling: Promise<void> | undefined;
  let receiving = Promise.resolve();
  const publish = (next: LiveMode) => {
    mode = next;
    options.onMode?.(next);
  };
  const pull = () => {
    pulling = options.trigger().catch(() => {
      if (!stopped) {
        fallback();
        publish("offline");
      }
    });
    return pulling;
  };
  const catchup = () => {
    clearTimeout(catchupTimer);
    if (stopped || mode !== "live") return;
    // Nudges can be lost after a committed write; bound staleness even on a healthy socket.
    catchupTimer = setTimeout(async () => {
      await pull();
      catchup();
    }, MAX_FALLBACK_MS);
  };
  const fallback = () => {
    clearTimeout(catchupTimer);
    if (stopped || timer) return;
    publish("polling");
    const delay = Math.min(FALLBACK_MS * 2 ** Math.min(attempt++, 4), MAX_FALLBACK_MS);
    timer = setTimeout(async () => {
      timer = undefined;
      await pull();
      if (!stopped) {
        connect();
        fallback();
      }
    }, delay);
  };
  const connect = () => {
    if (stopped) return;
    const previous = socket;
    socket = undefined;
    previous?.close();
    const url = new URL("/sync/live", options.config.upstream);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("cursor", options.cursor());
    try {
      const current = options.connect(url.toString(), {
        authorization: `Bearer ${options.config.deviceToken}`,
        "X-Shopper-Device": options.config.deviceId,
      });
      socket = current;
      current.on("open", () => {
        if (stopped || socket !== current) return;
        clearTimeout(timer);
        timer = undefined;
        attempt = 0;
        publish("live");
        void pull();
        if (options.onConnected)
          receiving = receiving.then(options.onConnected).catch(() => {
            current.close();
            fallback();
          });
        catchup();
      });
      current.on("message", (data) => {
        if (stopped || socket !== current) return;
        try {
          const message: unknown = JSON.parse(String(data));
          if (v.is(nudge, message)) void pull();
          const payment = v.safeParse(paymentNudge, message);
          if (payment.success && options.onPayment)
            receiving = receiving
              .then(() => options.onPayment?.(payment.output.payload))
              .then(() => undefined)
              .catch(() => {
                current.close();
                fallback();
              });
        } catch {
          current.close();
          fallback();
        }
      });
      current.on("close", () => {
        if (socket === current) fallback();
      });
      current.on("error", () => {
        if (socket === current) fallback();
      });
    } catch {
      fallback();
    }
  };
  return {
    start() {
      if (!stopped) return;
      stopped = false;
      connect();
      fallback();
    },
    getMode: () => mode,
    async stop() {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(catchupTimer);
      socket?.close();
      await pulling;
      await receiving;
    },
  };
}
