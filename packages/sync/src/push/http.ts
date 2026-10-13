import type { PushOptions } from "./types";
export function createPushTransport({ config, timeoutMs }: PushOptions) {
  let controller: AbortController | undefined;
  return {
    async request(path: string, body: unknown) {
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(() => current.abort(), timeoutMs ?? 120_000);
      try {
        const response = await fetch(new URL(path, config.upstream), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.deviceToken}`,
            "X-Shopper-Device": config.deviceId,
          },
          body: JSON.stringify(body),
          signal: current.signal,
        });
        return { response, raw: await response.text() };
      } finally {
        clearTimeout(timeout);
        controller = undefined;
      }
    },
    abort() {
      controller?.abort();
    },
  };
}
