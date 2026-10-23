import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { statementLink } from "@shopper/db-pg";
import { assertLinkSecret, hmacHex, hmacVerify } from "@shopper/utils";
import {
  statementLinkInput,
  statementTokenPayload,
  type StatementTokenPayload,
} from "../../schemas/customers/statements";
import type { Queryable } from "../../types";
import { CustomerError } from "../error";
import { readCustomerRow } from "../queries";
import { readStatementDocument } from "./document";

export const LINK_DAYS = 30;
type Target = { id: string; body: unknown };

const base64url = (text: string) =>
  btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fromBase64url = (text: string) => atob(text.replaceAll("-", "+").replaceAll("_", "/"));
const notFound = () => new CustomerError("NOT_FOUND", "Statement not found");

/** The token a customer holds: the payload, then its HMAC. Only the link row can make it count. */
export async function signStatementToken(secret: string, payload: StatementTokenPayload) {
  assertLinkSecret(secret);
  const body = base64url(JSON.stringify(payload));
  return `${body}.${await hmacHex(secret, body)}`;
}

/** Where the portal shows the statement for this token. */
export const statementLinkUrl = (baseUrl: string, token: string) => `${baseUrl}/statement/${token}`;

/** A new link to one customer's statement for a period; the caller signs the token. */
export const createStatementLink = defineCommand({
  name: "statement.link",
  async run(tx, ctx, input: Target) {
    const { from, to } = v.parse(statementLinkInput, input.body);
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    const [link] = await tx
      .insert(statementLink)
      .values({
        orgId: ctx.orgId,
        customerId: current.id,
        periodFrom: from,
        periodTo: to,
        expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000),
        createdBy: ctx.actorId!,
      })
      .returning({ id: statementLink.id, expiresAt: statementLink.expiresAt });
    return {
      id: link!.id,
      orgId: ctx.orgId,
      customerId: current.id,
      from,
      to,
      expiresAt: link!.expiresAt,
    };
  },
  audit: (_input, link) => ({ ...link, expiresAt: link.expiresAt.toISOString() }),
  details: (_input, link) => ({ entity: "statement_link", entityId: link.id }),
});

/** Revokes a link at once; revoking a revoked link changes nothing. */
export const revokeStatementLink = defineCommand({
  name: "statement.link.revoke",
  async run(tx, ctx, input: { id: string; linkId: string }) {
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    const [link] = await tx
      .select({ id: statementLink.id, revokedAt: statementLink.revokedAt })
      .from(statementLink)
      .where(
        and(
          eq(statementLink.orgId, ctx.orgId),
          eq(statementLink.customerId, current.id),
          eq(statementLink.id, input.linkId.toLowerCase()),
        ),
      );
    if (!link) throw notFound();
    if (!link.revokedAt)
      await tx
        .update(statementLink)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(statementLink.orgId, ctx.orgId), eq(statementLink.id, link.id)));
    return { id: link.id, customerId: current.id };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "statement_link", entityId: output.id }),
});

/** A customer's links, newest first, for the back office. The token is never stored, so it is not listed. */
export async function listStatementLinks(db: Queryable, orgId: string, customerId: string) {
  const current = await readCustomerRow(db, orgId, customerId);
  const rows = await db
    .select()
    .from(statementLink)
    .where(and(eq(statementLink.orgId, orgId), eq(statementLink.customerId, current.id)))
    .orderBy(desc(statementLink.createdAt), desc(statementLink.id));
  return rows.map((row) => ({
    id: row.id,
    from: row.periodFrom,
    to: row.periodTo,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    viewedAt: row.viewedAt?.toISOString() ?? null,
    viewCount: row.viewCount,
  }));
}

/**
 * The statement a token opens, counting the view. A bad signature, an expired, revoked or unknown link and a token
 * naming another org's link all throw the same NOT_FOUND, so a caller learns nothing about which it was.
 */
export async function readStatementByToken(
  db: Queryable,
  secret: string,
  token: string,
  now = new Date(),
) {
  const [body, signature, ...extra] = token.split(".");
  if (!body || !signature || extra.length || !(await hmacVerify(secret, body, signature)))
    throw notFound();
  const payload = parsePayload(body);
  if (payload.exp <= now.getTime()) throw notFound();
  // One statement does the checks and the count, so a link cannot be read without being counted.
  const [opened] = await db
    .update(statementLink)
    .set({ viewedAt: now, viewCount: sql`${statementLink.viewCount} + 1` })
    .where(
      and(
        eq(statementLink.id, payload.linkId),
        eq(statementLink.orgId, payload.orgId),
        eq(statementLink.customerId, payload.customerId),
        eq(statementLink.periodFrom, payload.from),
        eq(statementLink.periodTo, payload.to),
        isNull(statementLink.revokedAt),
        gt(statementLink.expiresAt, now),
      ),
    )
    .returning({ id: statementLink.id });
  if (!opened) throw notFound();
  return readStatementDocument(db, payload.orgId, payload.customerId, payload);
}

function parsePayload(body: string) {
  try {
    return v.parse(statementTokenPayload, JSON.parse(fromBase64url(body)));
  } catch {
    throw notFound();
  }
}
