import assert from "node:assert/strict";
import { WorkflowTimeoutError } from "@shopper/ports";
import type { ConformanceTest, Fixture } from "../types";

export function workflowCases(name: string, test: ConformanceTest, fixture: Fixture) {
  test(`${name}: Workflow delivers early events, times out, and retries steps idempotently`, async () => {
    const f = await fixture();
    const sender = f.workflow(`${f.orgId}:sender`);
    const receiver = f.workflow(`${f.orgId}:receiver`);
    await sender.send(receiver.instanceId, "ready", { accepted: true });
    assert.deepEqual(await receiver.waitFor("ready-step", "ready", 25), { accepted: true });

    let attempts = 0;
    const result = await receiver.step(
      "retry-step",
      { maxAttempts: 2, delayMs: 0, backoff: "constant" },
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("transient");
        return { completed: true };
      },
    );
    assert.deepEqual(result, { completed: true });
    assert.equal(attempts, 2);
    assert.deepEqual(
      await receiver.step(
        "retry-step",
        { maxAttempts: 2, delayMs: 0, backoff: "constant" },
        async () => {
          attempts += 1;
          return { completed: false };
        },
      ),
      { completed: true },
    );
    assert.equal(attempts, 2);

    const timeout = f.workflow(`${f.orgId}:timeout`);
    await assert.rejects(
      timeout.waitFor("missing-step", "missing", 5),
      (error: unknown) => error instanceof WorkflowTimeoutError,
    );
  });
}
