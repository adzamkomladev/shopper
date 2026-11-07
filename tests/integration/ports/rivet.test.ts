// The Workflow port on Rivet Workflows, against a real engine: the box runs every shared `run*` function through
// this adapter. The memory engine's contract (ports/workflow.ts) is the reference.
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { v7 } from "uuid";
import { rivetHost } from "@shopper/adapters-box";
import { WorkflowTimeoutError, type Json } from "@shopper/ports";
import { rivetEngine, rivetPool } from "../../support/rivet/engine";

const host = rivetHost({ ...rivetEngine, pool: rivetPool() });
const policy = { maxAttempts: 1, delayMs: 0, backoff: "constant" } as const;
const params = v.object({ note: v.optional(v.string()) });
const marks = new Map<string, Json[]>();
const mark = async (id: string, entry: Json) => {
  marks.set(id, [...(marks.get(id) ?? []), entry]);
  return entry;
};
const marked = (id: string) => () => marks.get(id) ?? [];
const until = { timeout: 15_000, interval: 50 };

test("an event sent before the wait is delivered, and before the start too", async () => {
  const launcher = host.launch("early", params, async (flow, input) => {
    const payload = await flow.waitFor("ready", "ready", 10_000);
    await flow.step("seen", policy, () =>
      mark(flow.instanceId, { payload, note: input.note ?? null }),
    );
  });
  const early = v7();
  await launcher.send(early, "ready", { accepted: true });
  await launcher.start(early, { note: "late start" });
  await expect
    .poll(marked(early), until)
    .toEqual([{ payload: { accepted: true }, note: "late start" }]);
});

test("a wait that times out throws WorkflowTimeoutError into the shared code", async () => {
  const launcher = host.launch("timeout", params, async (flow) => {
    const outcome = await flow
      .waitFor("missing", "missing", 200)
      .then(() => "delivered")
      .catch((error: unknown) => (error instanceof WorkflowTimeoutError ? error.type : "other"));
    await flow.step("outcome", policy, () => mark(flow.instanceId, outcome));
  });
  const id = v7();
  await launcher.start(id, {});
  await expect.poll(marked(id), until).toEqual(["missing"]);
});

test("steps retry by the port's policy and a name is stored once", async () => {
  let attempts = 0;
  const launcher = host.launch("retry", params, async (flow) => {
    const retry = { maxAttempts: 2, delayMs: 10, backoff: "constant" } as const;
    const first = await flow.step("flaky", retry, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("transient");
      return { attempt: attempts };
    });
    const again = await flow.step("flaky", retry, async () => ({ attempt: -1 }));
    await flow.step("result", policy, () => mark(flow.instanceId, { first, again }));
  });
  const id = v7();
  await launcher.start(id, {});
  await expect.poll(marked(id), until).toEqual([{ first: { attempt: 2 }, again: { attempt: 2 } }]);
  expect(attempts).toBe(2);
});

test("a step that keeps failing is catchable, and a catch-all never sees a suspension", async () => {
  const launcher = host.launch("catchall", params, async (flow) => {
    try {
      await flow.sleep("nap", 300);
      await flow.waitFor("nothing", "nothing", 300).catch(() => null);
      await flow.step("after-nap", policy, () => mark(flow.instanceId, "after nap"));
      await flow.step("boom", policy, async () => {
        throw new Error("provider down");
      });
    } catch (error) {
      await flow.step("caught", policy, () => mark(flow.instanceId, `caught ${String(error)}`));
    }
  });
  const id = v7();
  await launcher.start(id, {});
  await expect.poll(marked(id), until).toEqual(["after nap", "caught Error: provider down"]);
});

test("starting an instance twice runs it once", async () => {
  let runs = 0;
  const launcher = host.launch("once", params, async (flow) => {
    await flow.step("run", policy, async () => mark(flow.instanceId, ++runs));
  });
  const id = v7();
  await launcher.start(id, {});
  await launcher.start(id, {});
  await expect.poll(marked(id), until).toEqual([1]);
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(marked(id)()).toEqual([1]);
});

test("a loop kind wakes while running and runs again after it ended", async () => {
  let pass = 0;
  const launcher = host.launch(
    "loop",
    params,
    async (flow) => {
      const n = await flow.step("begin", policy, async () => ++pass);
      const woke = await flow
        .waitFor("wake", "wake", 1_500)
        .then(() => true)
        .catch(() => false);
      await flow.step("end", policy, () => mark(flow.instanceId, { n, woke }));
    },
    { loop: true },
  );
  const id = v7();
  await launcher.start(id, {});
  await new Promise((resolve) => setTimeout(resolve, 300));
  await launcher.start(id, {});
  // The wake ends pass 1 early; the start that came with it looks once more (pass 2), which sleeps out its wait.
  await expect.poll(marked(id), until).toEqual([
    { n: 1, woke: true },
    { n: 2, woke: false },
  ]);
  await launcher.start(id, {});
  await expect.poll(() => marked(id)().length, until).toBe(3);
});

test("sleepUntil waits for the instant and compensations run newest first, once", async () => {
  const launcher = host.launch("saga", params, async (flow) => {
    const at = await flow.step("at", policy, async () => Date.now() + 300);
    await flow.step(
      "reserve",
      policy,
      async () => "r1",
      () => mark(flow.instanceId, "undo reserve").then(() => {}),
    );
    await flow.step(
      "charge",
      policy,
      async () => "c1",
      () => mark(flow.instanceId, "undo charge").then(() => {}),
    );
    await flow.sleepUntil("later", new Date(at));
    await flow.step("woke", policy, async () =>
      mark(flow.instanceId, Date.now() >= at ? "on time" : "early"),
    );
    await flow.compensate();
    await flow.compensate();
  });
  const id = v7();
  await launcher.start(id, {});
  await expect.poll(marked(id), until).toEqual(["on time", "undo charge", "undo reserve"]);
});

const children: ReturnType<typeof spawn>[] = [];
afterAll(() => {
  for (const child of children) child.kill("SIGKILL");
});

test(
  "a flow sleeping in a host that dies finishes in the next host",
  { timeout: 120_000 },
  async () => {
    const pool = rivetPool();
    const file = join(await mkdtemp(join(tmpdir(), "shopper-rivet-")), "steps.log");
    const lines = () =>
      readFile(file, "utf8").then(
        (text) => text.trim().split("\n"),
        () => [],
      );
    const host = (...args: string[]) => {
      const child = spawn(
        "bun",
        [
          "--preload",
          "./tooling/build/bun.ts",
          "tests/support/rivet/child.ts",
          pool,
          file,
          ...args,
        ],
        {
          stdio: "ignore",
        },
      );
      children.push(child);
      return child;
    };
    const first = host(v7());
    await expect.poll(lines, until).toEqual([`before ${first.pid}`]);
    first.kill("SIGKILL");
    const second = host();
    // The engine hands the actor over once it gives the dead runner up (about 45 s).
    await expect
      .poll(lines, { timeout: 100_000, interval: 500 })
      .toEqual([`before ${first.pid}`, `after ${second.pid}`]);
  },
);
