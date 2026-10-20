import type { Portal } from "../api/portal";

export async function send(
  api: Portal["api"],
  cookie: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const response = await api.request(path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}
