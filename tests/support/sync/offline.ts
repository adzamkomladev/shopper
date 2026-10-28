// Offline sessions as the fixture register derives them after its server session expired.
//   offlineSale(overrides?, at?) -> pushes one sale at `at` under a new (or `overrides.id`) offline session
//   offlineRows(id)              -> the server's cashier_session rows for that id
//   deactivate(db, ctx, input)   -> sets or clears the member's deactivation time
import { expect } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { api, databases, fixtureSession, recordSale } from "../till/server";
import { pushEvents } from "../till/requests";

// The fixture till's server session ran 2025-12-31 16:00 to 2026-01-01 08:00; the register stays offline after.
export const hour = 3_600_000;
export const morning = Date.parse("2026-01-01T09:00:00.000Z");

/** A sale at `at` under an offline session the register derived from its expired server session. */
export async function offlineSale(
  overrides: {
    id?: string;
    issuedAt?: number;
    expiresAt?: number;
    permissions?: string[];
    proof?: string;
  } = {},
  at = morning + hour,
) {
  const parent = fixtureSession();
  const id = overrides.id ?? v7();
  const issuedAt = new Date(overrides.issuedAt ?? morning).toISOString();
  const expiresAt = new Date(overrides.expiresAt ?? morning + 8 * hour).toISOString();
  const permissions = overrides.permissions ?? parent.permissions;
  const proof = overrides.proof ?? `${parent.proof}.${id}`;
  const session = {
    ...parent,
    id,
    parentSessionId: parent.id,
    issuedAt,
    expiresAt,
    permissions,
    proof,
  };
  const sale = await recordSale({ session, at: new Date(at).toISOString() });
  const offline = { parentSessionId: parent.id, issuedAt, expiresAt, permissions };
  const response = await pushEvents(api, [sale.event], [{ sessionId: id, proof, offline }]);
  expect(response.status).toBe(200);
  return {
    id,
    sale,
    body: (await response.json()) as { accepted: unknown[]; rejected: unknown[] },
  };
}

export const offlineRows = (id: string) =>
  databases().db.select().from(schema.cashierSession).where(eq(schema.cashierSession.id, id));

export const deactivate = defineCommand({
  name: "sync.test.deactivate-member",
  async run(tx, ctx, input: { userId: string; at: Date | null }) {
    await tx
      .update(schema.member)
      .set({ deactivatedAt: input.at })
      .where(and(eq(schema.member.orgId, ctx.orgId), eq(schema.member.userId, input.userId)));
    return {};
  },
  audit: () => ({}),
});
