import assert from "node:assert/strict";
import type { ConformanceTest, LauncherFixture } from "../types";

export function workflowLauncherConformance(
  name: string,
  test: ConformanceTest,
  fixture: LauncherFixture,
) {
  test(`${name}: a launcher buffers early events and replay does not repeat delivery`, async () => {
    const f = await fixture(false);
    try {
      await assert.rejects(f.launcher.start("invalid:instance", f.params));
      await assert.rejects(async () =>
        f.launcher.send("invalid:instance", "auth-action", { action: "retry" }),
      );
      await f.launcher.start(f.instanceId, f.params);
      await f.launcher.send(f.instanceId, "auth-action", { action: "retry" });
      await f.launcher.send(f.instanceId, "auth-action", { action: "completed" });
      const steps = await f.waitForEnd();
      assert.deepEqual(Object.keys(steps).sort(), [
        "delivery-0",
        "delivery-1",
        "end",
        "prepare-delivery-0",
        "prepare-delivery-1",
      ]);
      assert.deepEqual(steps.end, { id: f.instanceId, expired: false });
      await f.launcher.start(f.instanceId, f.params);
      assert.deepEqual(await f.waitForEnd(), steps);
    } finally {
      await f.close();
    }
  });
  test(`${name}: a relaunched expired registration records expiry without delivery`, async () => {
    const f = await fixture(true);
    try {
      await f.launcher.start(f.instanceId, f.params);
      const steps = await f.waitForEnd();
      assert.deepEqual(steps["delivery-0"], {
        active: false,
        sent: false,
        expired: true,
        expiresAt: (steps["delivery-0"] as { expiresAt: string }).expiresAt,
      });
      assert.deepEqual(steps.end, { id: f.instanceId, expired: true });
    } finally {
      await f.close();
    }
  });
}
