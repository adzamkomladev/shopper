import { expect, test } from "vite-plus/test";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import {
  db,
  launcher,
  mail,
  prepareRegistration,
  track,
  waitForEnd,
} from "../../../support/workflows/auth";

const saveDelivery = defineCommand({
  name: "conformance.registration.saved-delivery",
  scope: "registration",
  async run(_tx, _context, input: { expiresAt: string }) {
    return { active: true, expired: false, expiresAt: input.expiresAt, sent: true };
  },
  audit: (_input, result) => ({ sent: result.sent }),
});

test("a fresh workflow engine reuses the database delivery outcome without sending again", async () => {
  const params = await prepareRegistration();
  const outcome = await saveDelivery(
    db,
    { orgId: params.id, appVersion: buildInfo.version },
    { expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    {
      instanceId: params.id,
      businessKey: params.id,
      type: "registration",
      step: "delivery-0",
      status: "waiting",
    },
  );
  const requestCount = mail.requests.length;
  const flow = launcher();
  track(params.id);
  await flow.start(params.id, params);
  await flow.send(params.id, "auth-action", { action: "completed" });
  const steps = await waitForEnd(params.id);
  expect(steps["delivery-0"]).toEqual(outcome);
  expect(Object.keys(steps).sort()).toEqual(["delivery-0", "end"]);
  expect(mail.requests).toHaveLength(requestCount);
});
