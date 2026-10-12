import { env, introspectWorkflowInstance } from "cloudflare:test";
import { test, expect } from "vitest";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import { cloudflareDatabase, cloudflareLauncher } from "@shopper/adapters-cf";
import { workflowLauncherConformance } from "@shopper/conformance";
import { createLinkToken, createOnboarding } from "@shopper/auth";

const bindings = env as {
  HYPERDRIVE: Hyperdrive;
  AUTH_FLOWS: Workflow;
  SHOPPER_LINK_SECRET: string;
};
const prepare = defineCommand({
  name: "conformance.registration",
  scope: "registration",
  async run(tx, ctx, input: { expired: boolean; digest?: string }) {
    await tx.insert(schema.registrationRequest).values({
      id: ctx.orgId,
      email: `${ctx.orgId}@example.com`,
      name: "Ama",
      shopName: "Ama Mart",
      shopCode: `ama-${ctx.orgId}`,
      verificationDigest: input.digest ?? "fixture-digest",
      verifiedAt: input.digest ? new Date() : undefined,
      expiresAt: new Date(Date.now() + (input.expired ? -1000 : 86_400_000)),
    });
    return { id: ctx.orgId };
  },
  audit: (_input, result) => result,
});

async function fixture(expired: boolean) {
  const id = v7();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  await prepare(connection.db, { orgId: id, appVersion: buildInfo.version }, { expired });
  const instance = await introspectWorkflowInstance(bindings.AUTH_FLOWS, id);
  return {
    launcher: cloudflareLauncher(bindings.AUTH_FLOWS),
    instanceId: id,
    params: { id, purpose: "registration" },
    async waitForEnd() {
      await instance.waitForStatus("complete");
      const rows = await connection.db
        .select()
        .from(schema.registrationWorkflowStep)
        .where(eq(schema.registrationWorkflowStep.instanceId, id));
      return Object.fromEntries(rows.map((row) => [row.name, row.output]));
    },
    async close() {
      await instance.dispose();
      await connection.close();
    },
    instance,
  };
}
workflowLauncherConformance("Cloudflare auth launcher in workerd", test, fixture);

test("the real Cloudflare event timeout records registration expiry", async () => {
  const f = await fixture(false);
  try {
    await f.instance.modify(async (modifier) => {
      await modifier.forceEventTimeout({ name: "action-0" });
    });
    await f.launcher.start(f.instanceId, f.params);
    const steps = await f.waitForEnd();
    expect(steps.end).toEqual({ id: f.instanceId, expired: true });
  } finally {
    await f.close();
  }
});

test("registration completion stays successful when its real workflow instance is missing", async () => {
  const id = v7();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  try {
    const token = await createLinkToken(bindings.SHOPPER_LINK_SECRET, "registration", id);
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    await prepare(
      connection.db,
      { orgId: id, appVersion: buildInfo.version },
      { expired: false, digest },
    );
    const service = createOnboarding({
      database: connection.db,
      linkSecret: bindings.SHOPPER_LINK_SECRET,
      baseURL: "https://shopper.test",
      launcher: cloudflareLauncher(bindings.AUTH_FLOWS),
    });
    expect(
      await service.complete({ id, token, password: "worker-registration-password-123" }),
    ).toMatchObject({ orgId: id });
    const [step] = await connection.db
      .select()
      .from(schema.registrationWorkflowStep)
      .where(eq(schema.registrationWorkflowStep.instanceId, id));
    expect(step).toMatchObject({ name: "completion-signal", output: { id, notified: false } });
    expect(
      await connection.db.select().from(schema.user).where(eq(schema.user.orgId, id)),
    ).toHaveLength(1);
  } finally {
    await connection.close();
  }
});
