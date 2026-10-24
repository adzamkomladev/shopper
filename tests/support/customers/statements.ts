// Statement sending and links from the back office, plus the public reads, as plain HTTP calls.
//   statementApi(owner, cookie) -> { send, link, links, revoke } as a signed-in member
//   publicRead(owner, token)    -> { json, pdf } with no session at all
//   deliveries(customer)        -> the customer's statement_delivery rows
//   linkRow(linkId)             -> one statement_link row
import { sql } from "drizzle-orm";
import type { Portal } from "../api/portal";
import { databases } from "../till/server";

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

export function statementApi(owner: Portal, cookie: string) {
  const at = (id: string, tail: string) => `/customers/${id}${tail}`;
  return {
    send: (id: string, body: unknown) => call(owner, cookie, "POST", at(id, "/statements"), body),
    link: (id: string, body: unknown) =>
      call(owner, cookie, "POST", at(id, "/statement/links"), body),
    links: (id: string) => call(owner, cookie, "GET", at(id, "/statement/links")),
    revoke: (id: string, linkId: string) =>
      call(owner, cookie, "DELETE", at(id, `/statement/links/${linkId}`)),
  };
}

export async function publicRead(owner: Portal, token: string) {
  const json = await owner.api.request(`/public/statements/${token}`);
  const pdf = await owner.api.request(`/public/statements/${token}/pdf`);
  return {
    json: { status: json.status, text: await json.text() },
    pdf: {
      status: pdf.status,
      type: pdf.headers.get("content-type"),
      bytes: new Uint8Array(await pdf.arrayBuffer()),
    },
  };
}

export async function deliveries(customerId: string) {
  const { rows } = await databases().db.execute<Record<string, any>>(sql`
    SELECT id, channel, status, provider_reference, link_id, period_from::text AS period_from,
      period_to::text AS period_to
    FROM statement_delivery WHERE customer_id = ${customerId} ORDER BY channel, id`);
  return rows;
}

export async function linkRow(linkId: string) {
  const { rows } = await databases().db.execute<Record<string, any>>(sql`
    SELECT id, org_id, customer_id, view_count, viewed_at, revoked_at, expires_at
    FROM statement_link WHERE id = ${linkId}`);
  return rows[0]!;
}
