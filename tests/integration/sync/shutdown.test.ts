import { setImmediate } from "node:timers/promises";
import { afterEach, expect, test } from "vite-plus/test";
import { defineCommand } from "@shopper/audit/sqlite";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture, type PushFixture } from "../../support/till/push";
let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

test("stopping waits for pending SQLite work before returning", async () => {
  fixture = await createPushFixture();
  await fixture.recordSale();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = () => {};
  const acquired = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let holding: Promise<void> | undefined;
  let emptyReports = 0;
  const hold = defineCommand({
    name: "till.test.hold",
    run: async () => {
      entered();
      await gate;
    },
    audit: () => ({}),
  });
  const worker = createPushWorker({
    ...fixture.workerOptions,
    onStatus: (status) => {
      if (status.server !== "online" || status.pendingCount !== 0 || ++emptyReports !== 2) return;
      if (!fixture) throw new Error("Expected a live fixture");
      holding = hold(fixture.database, fixture.workerOptions.config, undefined);
    },
  });
  fixture.worker = worker;
  worker.start();
  await acquired;
  await setImmediate();
  let completed = false;
  const stopping = worker.stop().then(() => {
    completed = true;
  });
  try {
    await setImmediate();
    expect(completed).toBe(false);
  } finally {
    release();
    await holding;
    await stopping;
  }
  expect(completed).toBe(true);
});

test("stopping during a queued SQLite read prevents a later handshake", async () => {
  fixture = await createPushFixture();
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let entered = () => {};
  const acquired = new Promise<void>((resolve) => (entered = resolve));
  const hold = defineCommand({
    name: "till.test.startup.hold",
    async run() {
      entered();
      await gate;
    },
    audit: () => ({}),
  });
  const holding = hold(fixture.database, fixture.workerOptions.config, undefined);
  await acquired;
  const worker = createPushWorker(fixture.workerOptions);
  fixture.worker = worker;
  worker.start();
  const stopping = worker.stop();
  release();
  await holding;
  await stopping;
  expect(fixture.upstream.requests).toHaveLength(0);
});
