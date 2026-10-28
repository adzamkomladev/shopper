// Day 25 performance pass, run on request (`SHOPPER_PERF=1 vp test --run tests/perf`), never as a CI gate. Each
// measurement prints one JSON line with its p50 and p95; docs/plans/day25/verification.md records the numbers.
import { cpus } from "node:os";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { goldenReceipt } from "../support/hardware/receipt";
import { createConnectionHost } from "../support/till/connection/host";
import { createConnectionServer } from "../support/till/connection/server";

const cleanup: (() => Promise<unknown>)[] = [];
afterAll(async () => {
  for (const step of cleanup.reverse()) await step();
});

describe.runIf(process.env.SHOPPER_PERF === "1")("till performance", () => {
  test("receipt render: the golden receipt to an 80 mm PNG", async () => {
    const renderer = boxRenderer();
    const timings = await repeat(20, () =>
      renderer.receipt(
        JSON.parse(JSON.stringify(goldenReceipt())),
        { paperMm: 80, reprint: false },
        "png",
      ),
    );
    report("receipt render", timings);
  }, 120_000);

  test("till host cold boot: spawn to ready, with an enrolled config", async () => {
    const server = await createConnectionServer("connected-empty");
    cleanup.push(() => server.close());
    const timings = await repeat(5, async () => {
      const fixture = await createConnectionHost(server, server.api!.url, "http://127.0.0.1:5184");
      const started = performance.now();
      await fixture.start();
      const took = performance.now() - started;
      await fixture.close();
      return took;
    });
    report("till host cold boot", timings);
  }, 300_000);

  // The host's half of scan-to-line: an add over its private channel, answered with the new draft. The browser's
  // half (the scan detector and one render) is not in this number.
  test("till scan to line: add a product and get the draft back", async () => {
    const server = await createConnectionServer("connected-empty");
    cleanup.push(() => server.close());
    const fixture = await createConnectionHost(server, server.api!.url, "http://127.0.0.1:5184");
    cleanup.push(() => fixture.close());
    const host = await fixture.start();
    let revision = 0;
    const timings = await repeat(30, async () => {
      const reply = await host.request({
        type: "add",
        expectedRevision: revision,
        productId: server.productId,
      });
      expect(reply).toMatchObject({ kind: "draft" });
      revision += 1;
    });
    report("till scan to line (host)", timings);
  }, 300_000);
});

/** Runs `work` n times in a row; a number it returns is the measured part, otherwise the whole call is. */
async function repeat(n: number, work: () => Promise<unknown>) {
  const timings: number[] = [];
  for (let run = 0; run < n; run++) {
    const started = performance.now();
    const result = await work();
    timings.push(typeof result === "number" ? result : performance.now() - started);
  }
  expect(timings).toHaveLength(n);
  return timings;
}

function report(suite: string, timings: number[]) {
  const sorted = [...timings].sort((a, b) => a - b);
  const at = (p: number) =>
    +sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!.toFixed(1);
  console.log(
    JSON.stringify({
      suite,
      runs: timings.length,
      firstMs: +timings[0]!.toFixed(1),
      p50Ms: at(0.5),
      p95Ms: at(0.95),
      cpu: cpus()[0]?.model,
      node: process.version,
    }),
  );
}
