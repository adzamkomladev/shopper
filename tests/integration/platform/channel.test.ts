// A platform admin moves a shop between till release feeds: `pilot` gets a release first, `stable` after promotion.
// The change is audited in the platform's chain, with the admin as actor, in the same transaction as the write.
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { asStaff, context, cookies, db, platformContext, tenantApi } from "./support";
import { request } from "../auth/setup";

const channelOf = async () =>
  (
    await db
      .select({ channel: schema.org.updateChannel })
      .from(schema.org)
      .where(eq(schema.org.id, context.orgId))
  )[0]!.channel;
const audits = () =>
  db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, platformContext.orgId),
        eq(schema.auditLog.command, "platform.tenant.channel"),
      ),
    );

test("a platform admin puts a shop on the pilot channel, audited in the platform's chain", async () => {
  expect(await channelOf()).toBe("stable");
  const reply = await asStaff(`/platform/tenants/${context.orgId}/channel`, "POST", {
    channel: "pilot",
  });
  expect(reply.status).toBe(200);
  expect(await reply.json()).toMatchObject({ id: context.orgId, updateChannel: "pilot" });
  expect(await channelOf()).toBe("pilot");
  const [row] = await audits();
  expect(row).toMatchObject({ entityId: context.orgId });
  expect(row?.payload).toMatchObject({ orgId: context.orgId, before: "stable", after: "pilot" });
  const tenants = (await (await asStaff("/platform/tenants")).json()) as Record<string, unknown>[];
  expect(tenants.find((tenant) => tenant.id === context.orgId)).toMatchObject({
    updateChannel: "pilot",
  });
});

test("a shop's owner and a platform member without the permission are refused", async () => {
  const path = `/platform/tenants/${context.orgId}/channel`;
  const body = { channel: "stable" };
  expect((await request(tenantApi, cookies.get("superadmin")!, path, "POST", body)).status).toBe(
    403,
  );
  expect((await asStaff(path, "POST", body, "cashier")).status).toBe(403);
  expect(await channelOf()).toBe("pilot");
});

test("a channel that is not pilot or stable is refused and nothing changes", async () => {
  const before = (await audits()).length;
  const reply = await asStaff(`/platform/tenants/${context.orgId}/channel`, "POST", {
    channel: "beta",
  });
  expect(reply.status).toBe(400);
  expect(await channelOf()).toBe("pilot");
  expect(await audits()).toHaveLength(before);
});
