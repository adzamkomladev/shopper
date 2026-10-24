// Typed callers for the customer API as a signed-in member (see tests/support/api/portal.ts).
import type { Portal } from "../api/portal";

export type CustomerBody = {
  id: string;
  name: string;
  phone: string;
  kind: "individual" | "business";
  businessName?: string;
  tin?: string;
  email?: string;
};

/** Like the stock helper, but a non-JSON reply (a missing route's "404 Not Found") is kept as `{ raw }`. */
async function call(owner: Portal, cookie: string, method: string, path: string, body?: unknown) {
  const response = await owner.api.request(path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed };
}

export function customerApi(owner: Portal, cookie: string) {
  const path = (id: string, tail = "") => `/customers/${id}${tail}`;
  return {
    create: (body: unknown) => call(owner, cookie, "POST", "/customers", body),
    list: (query = "") => call(owner, cookie, "GET", `/customers${query ? `?${query}` : ""}`),
    read: (id: string) => call(owner, cookie, "GET", path(id)),
    patch: (id: string, body: unknown) => call(owner, cookie, "PATCH", path(id), body),
    archive: (id: string) => call(owner, cookie, "POST", path(id, "/archive")),
    unarchive: (id: string) => call(owner, cookie, "POST", path(id, "/unarchive")),
    merge: (winnerId: string, loserId: string) =>
      call(owner, cookie, "POST", path(winnerId, "/merge"), { loserId }),
    async csv() {
      const response = await owner.api.request("/customers/export.csv", { headers: { cookie } });
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        text: await response.text(),
      };
    },
  };
}

/** RFC 4180 rows: quoted cells, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') ((cell += '"'), i++);
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (rows.at(-1)!.push(cell), (cell = ""));
    else if (c === "\n") (rows.at(-1)!.push(cell.replace(/\r$/, "")), rows.push([]), (cell = ""));
    else cell += c;
  }
  rows.at(-1)!.push(cell);
  return rows;
}
