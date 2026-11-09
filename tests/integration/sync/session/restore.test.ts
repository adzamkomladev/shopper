// A box restored from a dump older than a sign-in has no row for that session. The register sends the grant the
// box signed at sign-in; the box records the session again from it, once and audited, and takes nothing else.
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { offlineWithheld } from "@shopper/core/schemas";
import {
  api,
  databases,
  deviceId,
  deviceToken,
  devices,
  fixtureSession,
  principal,
  recordSale,
} from "../../../support/till/server";
import { pushEvents } from "../../../support/till/requests";
import { offlineRows } from "../../../support/sync/offline";

test("a session the restore lost comes back from its grant, once, and its sales are accepted", async () => {
  const session = await signInLost();
  for (const _ of [1, 2]) {
    const sale = await recordSale({ session, at: new Date().toISOString() });
    const response = await pushEvents(
      api,
      [sale.event],
      [{ sessionId: session.id, proof: session.proof, grant: session.grant }],
    );
    expect((await response.json()).accepted).toHaveLength(1);
  }
  expect(await offlineRows(session.id)).toMatchObject([
    { userId: principal.userId, deviceId, parentSessionId: null, revokedAt: null },
  ]);
  expect(await restores(session.id)).toHaveLength(1);
});

test("an offline session under a lost server session comes back with its parent", async () => {
  const parent = await signInLost();
  const id = v7();
  const issuedAt = parent.issuedAt;
  const expiresAt = new Date(Date.parse(issuedAt) + 8 * 3_600_000).toISOString();
  const proof = `${parent.proof}.${id}`;
  // As the register derives it: the parent's permissions without the manager ones.
  const permissions = parent.permissions.filter((code) => !offlineWithheld.includes(code));
  const sale = await recordSale({
    session: { ...parent, id, parentSessionId: parent.id, issuedAt, expiresAt, permissions, proof },
    at: new Date().toISOString(),
  });
  const offline = { parentSessionId: parent.id, issuedAt, expiresAt, permissions };
  const response = await pushEvents(
    api,
    [sale.event],
    [{ sessionId: id, proof, offline, grant: parent.grant }],
  );
  expect((await response.json()).accepted).toHaveLength(1);
  expect(await offlineRows(parent.id)).toHaveLength(1);
  expect(await offlineRows(id)).toMatchObject([{ parentSessionId: parent.id }]);
});

test("a grant that was altered, or sent with another proof, restores nothing", async () => {
  const session = await signInLost();
  const [body, mac] = session.grant.split(".") as [string, string];
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  const widened = Buffer.from(
    JSON.stringify({ ...claims, permissions: [...claims.permissions, "refund.approve"] }),
  ).toString("base64url");
  const other = await signInLost();
  for (const credential of [
    { proof: session.proof, grant: `${widened}.${mac}` },
    { proof: session.proof, grant: `${body}.${"0".repeat(mac.length)}` },
    // Another session's genuine grant does not vouch for this proof.
    { proof: session.proof, grant: other.grant },
  ]) {
    const sale = await recordSale({ session, at: new Date().toISOString() });
    const response = await pushEvents(
      api,
      [sale.event],
      [{ sessionId: session.id, ...credential }],
    );
    expect((await response.json()).rejected).toMatchObject([{ code: "INVALID_SESSION" }]);
  }
  expect(await offlineRows(session.id)).toEqual([]);
  expect(await restores(session.id)).toEqual([]);
});

/** A fresh sign-in on the fixture register whose row is then lost, as a restore from an older dump loses it. */
async function signInLost() {
  const login = await devices.login({
    deviceId,
    deviceToken,
    userId: principal.userId,
    pin: "1357",
  });
  await lose(databases().db, databases().context, { sessionId: login.id });
  return {
    ...fixtureSession(),
    id: login.id,
    issuedAt: login.issuedAt.toISOString(),
    expiresAt: login.expiresAt.toISOString(),
    permissions: login.permissions,
    proof: login.token,
    grant: login.grant,
  };
}

const restores = (id: string) =>
  databases()
    .db.select()
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.command, "cashier.session.restore"), eq(schema.auditLog.entityId, id)),
    );

const lose = defineCommand({
  name: "sync.test.lose-session",
  async run(tx, ctx, input: { sessionId: string }) {
    await tx
      .delete(schema.cashierSession)
      .where(
        and(
          eq(schema.cashierSession.orgId, ctx.orgId),
          eq(schema.cashierSession.id, input.sessionId),
        ),
      );
    return {};
  },
  audit: () => ({}),
});
