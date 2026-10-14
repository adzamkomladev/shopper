import type { PushOptions } from "./types";

type TransportOptions = Pick<PushOptions, "config" | "timeoutMs">;
export function createPushTransport({ config, timeoutMs }: TransportOptions) {
  let controller: AbortController | undefined;
  let aborted = false;
  return {
    async request(path: string, body?: unknown) {
      if (aborted) throw new DOMException("Sync transport stopped", "AbortError");
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(() => current.abort(), timeoutMs ?? 120_000);
      try {
        const response = await fetch(new URL(path, config.upstream), {
          method: body === undefined ? "GET" : "POST",
          headers: {
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            "X-Shopper-Protocol": String(config.protocol),
            authorization: `Bearer ${config.deviceToken}`,
            "X-Shopper-Device": config.deviceId,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: current.signal,
        });
        return { response, raw: await response.text() };
      } finally {
        clearTimeout(timeout);
        controller = undefined;
      }
    },
    abort() {
      aborted = true;
      controller?.abort();
    },
  };
}
