// A loop workflow that finds nothing due listens briefly for a wake already buffered before it ends: Cloudflare drops
// a wake sent as an instance ends. Driven with a fake flow whose only wake is the one buffered on the first look.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { runAccount, runStatementSchedule } from "@shopper/core/customers";
import { WorkflowTimeoutError } from "@shopper/ports";
import { goldenWorld } from "../../support/sales/golden/setup";
import { addCustomer } from "../../support/customers/seed";
import { ids } from "../../support/till/sales";
import { databases } from "../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => world?.local.close());

const params = (customerId: string) => ({ orgId: ids.org, customerId });

test("a wake buffered as the loop finds nothing due makes it look again before it ends (account and statements)", async () => {
  const customerId = await addCustomer({ phone: "0271796009" });
  const fake = (instanceId: string) => {
    const waits: string[] = [];
    const steps: string[] = [];
    return {
      waits,
      steps,
      flow: {
        instanceId,
        step: (name: string, _policy: unknown, fn: () => Promise<unknown>) => {
          steps.push(name);
          return fn();
        },
        waitFor: async (name: string, _event: string, timeoutMs: number) => {
          waits.push(name);
          if (name !== "last-0")
            throw new WorkflowTimeoutError(instanceId, name, "wake", timeoutMs);
          return undefined;
        },
      } as never,
    };
  };
  const deps = {
    withDatabase: (fn: never) => (fn as any)(databases().db),
    appVersion: "test",
  } as never;
  const account = fake(customerId);
  await runAccount(account.flow, deps, params(customerId));
  expect(account.waits).toEqual(["last-0", "last-1"]);
  expect(account.steps).toEqual(["due-0", "due-1", "end"]);
  const statements = fake(ids.org);
  await runStatementSchedule(statements.flow, deps, { orgId: ids.org, actorId: ids.cashier });
  expect(statements.waits).toEqual(["last-0", "last-1"]);
});
