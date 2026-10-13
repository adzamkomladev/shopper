import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import * as schema from "@shopper/db-pg";
import {
  db,
  launcher,
  mail,
  prepareRegistration,
  track,
  waitForEnd,
} from "../../../support/workflows/auth";

const prepare = defineCommand({
  name: "conformance.registration.prepared",
  scope: "registration",
  async run(tx, context) {
    const [row] = await tx
      .select()
      .from(schema.registrationRequest)
      .where(eq(schema.registrationRequest.id, context.orgId));
    if (!row) throw new Error("Registration fixture is missing");
    return {
      active: true,
      expired: false,
      expiresAt: row.expiresAt.toISOString(),
      email: row.email,
      channel: "email",
      shopCode: "",
    };
  },
  audit: (_input, result) => ({ active: result.active }),
});
const finish = defineCommand({
  name: "conformance.registration.inactive",
  scope: "registration",
  async run(tx, context, input: { completed: boolean }) {
    await tx
      .update(schema.registrationRequest)
      .set(
        input.completed ? { completedAt: new Date() } : { expiresAt: new Date(Date.now() - 1000) },
      )
      .where(eq(schema.registrationRequest.id, context.orgId));
    return { id: context.orgId };
  },
  audit: (_input, result) => result,
});

test.each([false, true])(
  "replayed registration preparation rechecks completed=%s before email",
  async (completed) => {
    const params = await prepareRegistration();
    const context = { orgId: params.id, appVersion: buildInfo.version };
    const saved = await prepare(db, context, undefined, {
      instanceId: params.id,
      businessKey: params.id,
      type: "registration",
      step: "prepare-delivery-0",
      status: "waiting",
    });
    await finish(db, context, { completed });
    const requestCount = mail.requests.length;
    const flow = launcher();
    track(params.id);
    await flow.start(params.id, params);
    await flow.send(params.id, "auth-action", { action: "completed" });
    const steps = await waitForEnd(params.id);
    expect(steps["prepare-delivery-0"]).toEqual(saved);
    expect(steps["delivery-0"]).toMatchObject({ active: false, sent: false, expired: !completed });
    expect(steps.end).toEqual({ id: params.id, expired: !completed });
    expect(mail.requests).toHaveLength(requestCount);
  },
);
