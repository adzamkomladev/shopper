import { env, introspectWorkflowInstance } from "cloudflare:test";
import { expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import { money } from "@shopper/money";
import { cloudflareDatabase, cloudflareLauncher } from "@shopper/adapters-cf";

const bindings = env as {
  HYPERDRIVE: Hyperdrive;
  KYC_FLOWS: Workflow;
  ARKESEL_BASE_URL: string;
};
let sequence = 0;
const seed = defineCommand({
  name: "worker.kyc.seed",
  async run(tx, ctx, input: { caseId: string; phone: string }) {
    await tx.insert(schema.org).values({ id: ctx.orgId, name: "Worker KYC" });
    const userId = v7();
    await tx
      .insert(schema.user)
      .values({ id: userId, orgId: ctx.orgId, email: `${userId}@example.com`, name: "Accountant" });
    const [customer] = await tx
      .insert(schema.customer)
      .values({ orgId: ctx.orgId, name: "Kofi Credit", phone: input.phone })
      .returning();
    await tx.insert(schema.kycCase).values({
      id: input.caseId,
      orgId: ctx.orgId,
      customerId: customer!.id,
      purpose: "credit",
      requestedLimit: money(5_000_000),
      phone: input.phone,
      openedBy: userId,
    });
    await tx.insert(schema.workflowRun).values({
      orgId: ctx.orgId,
      instanceId: input.caseId,
      businessKey: input.caseId,
      type: "kyc",
      currentStep: "opened",
      status: "waiting",
    });
    return { userId };
  },
  audit: () => ({}),
});

async function texted(phone: string) {
  const sent = (await (await fetch(`${bindings.ARKESEL_BASE_URL}/test/requests`)).json()) as {
    message: string;
    recipients: string[];
  }[];
  return sent.filter((request) => request.recipients.includes(phone.replace(/^0/, "233")));
}

test("KycWorkflow texts a code, texts another on resend and completes once the case is decided", async () => {
  const orgId = v7();
  const caseId = v7();
  const phone = `0246${String(Date.now()).slice(-6)}${++sequence}`.slice(0, 10);
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  const instance = await introspectWorkflowInstance(bindings.KYC_FLOWS, caseId);
  try {
    const { userId } = await seed(
      connection.db,
      { orgId, appVersion: buildInfo.version },
      { caseId, phone },
    );
    const launcher = cloudflareLauncher(bindings.KYC_FLOWS);
    await launcher.start(caseId, { orgId, id: caseId });
    await vi.waitFor(async () => expect(await texted(phone)).toHaveLength(1), { timeout: 15_000 });
    const where = eq(schema.kycCase.id, caseId);
    const [first] = await connection.db.select().from(schema.kycCase).where(where);
    expect(first).toMatchObject({ status: "otp_sent", otpSends: 1 });
    expect(first!.otpDigest).toMatch(/^[0-9a-f]{64}$/);

    await launcher.send(caseId, "kyc", { action: "resend" });
    await vi.waitFor(async () => expect(await texted(phone)).toHaveLength(2), { timeout: 15_000 });
    const [second] = await connection.db.select().from(schema.kycCase).where(where);
    expect(second).toMatchObject({ otpSends: 2 });
    expect(second!.otpDigest).not.toBe(first!.otpDigest);
    const codes = (await texted(phone)).map((sms) => sms.message.match(/\d{6}/)?.[0]);
    expect(new Set(codes).size).toBe(2);

    // The case is decided elsewhere (the API); the event only wakes the workflow, which reads the row.
    await connection.db
      .update(schema.kycCase)
      .set({ status: "rejected", decidedBy: userId, decidedAt: new Date(), decisionNote: "No" })
      .where(where);
    await launcher.send(caseId, "kyc", { action: "decided" });
    await instance.waitForStatus("complete");
    const [run] = await connection.db
      .select()
      .from(schema.workflowRun)
      .where(eq(schema.workflowRun.instanceId, caseId));
    expect(run).toMatchObject({ type: "kyc", status: "completed", currentStep: "close" });
    const steps = await connection.db
      .select()
      .from(schema.workflowStep)
      .where(eq(schema.workflowStep.instanceId, caseId));
    // No step output holds a code or a digest.
    const stored = JSON.stringify(steps);
    for (const code of codes) expect(stored).not.toContain(String(code));
    expect(stored).not.toContain(second!.otpDigest!);
  } finally {
    await instance.dispose();
    await connection.close();
  }
}, 60_000);
