import { createServer } from "node:net";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { hashPassword } from "../auth/password";
import { context, databases } from "../till/server";

/**
 * The shop's WAN unplugged, for a box process: pass `env` to it. Bun's fetch sends every non-local request to this
 * proxy, which hangs up on it, so a call to the internet fails as it does with no route; LAN and loopback go direct.
 * `attempts` lists what the box tried to reach (`CONNECT host:443` or `GET http://host/…`).
 */
export async function unplugInternet() {
  const attempts: string[] = [];
  const trap = createServer((socket) => {
    socket.once("data", (chunk) => {
      attempts.push(chunk.toString("latin1").split("\r\n")[0] ?? "");
      socket.destroy();
    });
  });
  await new Promise<void>((resolve) => trap.listen(0, "127.0.0.1", resolve));
  const proxy = `http://127.0.0.1:${(trap.address() as { port: number }).port}`;
  const local = "127.0.0.1,localhost,.local";
  return {
    env: {
      HTTP_PROXY: proxy,
      HTTPS_PROXY: proxy,
      http_proxy: proxy,
      https_proxy: proxy,
      NO_PROXY: local,
      no_proxy: local,
    },
    attempts,
    close: () => new Promise<void>((resolve) => trap.close(() => resolve())),
  };
}

/** A password for the suite's cashier, so a register signs in on the box as a cashier does at the till. */
export async function setCashierPassword(userId: string, password: string) {
  await setPassword(databases().db, context, { userId, password });
}

/**
 * Grants the suite's cashier role `code` as an owner would in the role editor (permissions are data); the returned
 * function takes it back, so other suites on this database see the role as seeded.
 */
export async function grantCashier(code: string) {
  const { db } = databases();
  const [role] = await db
    .select({ id: schema.role.id })
    .from(schema.role)
    .where(and(eq(schema.role.orgId, context.orgId), eq(schema.role.name, "cashier")));
  const [permission] = await db
    .select({ id: schema.permission.id })
    .from(schema.permission)
    .where(and(eq(schema.permission.orgId, context.orgId), eq(schema.permission.code, code)));
  const row = { orgId: context.orgId, roleId: role!.id, permissionId: permission!.id };
  await grant(db, context, { row, granted: true });
  return () => grant(db, context, { row, granted: false });
}

const grant = defineCommand({
  name: "drill.test.role-permission",
  async run(
    tx,
    _ctx,
    input: { row: { orgId: string; roleId: string; permissionId: string }; granted: boolean },
  ) {
    if (input.granted)
      await tx.insert(schema.rolePermission).values(input.row).onConflictDoNothing();
    else
      await tx
        .delete(schema.rolePermission)
        .where(
          and(
            eq(schema.rolePermission.orgId, input.row.orgId),
            eq(schema.rolePermission.roleId, input.row.roleId),
            eq(schema.rolePermission.permissionId, input.row.permissionId),
          ),
        );
    return {};
  },
  audit: () => ({}),
});

const setPassword = defineCommand({
  name: "drill.test.cashier-password",
  async run(tx, ctx, input: { userId: string; password: string }) {
    await tx.delete(schema.account).where(eq(schema.account.userId, input.userId));
    await tx.insert(schema.account).values({
      orgId: ctx.orgId,
      userId: input.userId,
      accountId: input.userId,
      providerId: "credential",
      password: await hashPassword(input.password),
    });
    return {};
  },
  audit: () => ({}),
});
