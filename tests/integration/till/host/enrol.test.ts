import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { org } from "@shopper/db-pg";
import { api, context, databases, devices, principal } from "../../../support/till/server";
import { ids } from "../../../support/till/sales";
import { startTillHost } from "../../../support/till/host/process";
import { connectBrowser } from "../../../support/till/host/socket";
import { e2eRun } from "../../../../tooling/e2e/run";

const ORIGIN = "http://127.0.0.1:5184";
let cleanup: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const step of cleanup.reverse()) await step();
  cleanup = [];
});

describe("a till enrols itself", () => {
  it("starts unenrolled, refuses a bad code, enrols with a good one and boots with the same bridge", async () => {
    const config = await unenrolledConfig();
    const host = await startTillHost(config);
    cleanup.push(() => host.stop());
    expect(host.ready.identity).toBeUndefined();
    expect(await host.request({ type: "status" })).toMatchObject({ kind: "unenrolled" });

    const shopCode = await slug();
    expect(
      await host.request({
        type: "device.enrol",
        shopCode: "no-such-shop",
        code: "123456",
        name: "Till 1",
      }),
    ).toMatchObject({ type: "error", code: "SHOP_NOT_FOUND" });
    expect(
      await host.request({ type: "device.enrol", shopCode, code: "000000", name: "Till 1" }),
    ).toMatchObject({ type: "error", code: "ENROL_REFUSED" });

    const challenge = await devices.issueEnrollment(principal, { branchId: ids.branch });
    const parent = host.waitForMessage((message) => message.type === "enrolled");
    const reply = await host.request({
      type: "device.enrol",
      shopCode,
      code: challenge.code,
      name: "Front till",
    });
    expect(reply).toMatchObject({
      type: "result",
      kind: "enrolled",
      identity: { orgId: context.orgId, branchId: ids.branch, registerName: "Front till" },
    });
    // The parent owns the register file: it gets the registration to store, then starts the host with it.
    const registration = (await parent).registration as Record<string, unknown>;
    expect(registration.deviceToken).toMatch(/^[a-f0-9]{64}$/);
    expect(registration.receiptCodes).toMatchObject({ branchCode: expect.stringMatching(/^BR/) });
    const ready = host.waitForMessage((message) => message.type === "ready");
    host.child.send({ type: "start", config: { ...config, ...registration, session: null } });
    // Same port and capability, so the page that enrolled reconnects without a new link.
    expect(await ready).toMatchObject({
      port: host.ready.port,
      capability: host.ready.capability,
      identity: { orgId: context.orgId, registerName: "Front till" },
    });
    // A used code is refused like any other.
    const again = await startTillHost(await unenrolledConfig());
    cleanup.push(() => again.stop());
    expect(
      await again.request({ type: "device.enrol", shopCode, code: challenge.code, name: "Till 2" }),
    ).toMatchObject({ type: "error", code: "ENROL_REFUSED" });
  });

  it("says the server cannot be reached and stays unenrolled", async () => {
    const host = await startTillHost({
      ...(await unenrolledConfig()),
      upstream: "http://127.0.0.1:1",
    });
    cleanup.push(() => host.stop());
    expect(
      await host.request({ type: "device.enrol", shopCode: "any", code: "123456", name: "Till" }),
    ).toMatchObject({ type: "error", code: "OFFLINE" });
    expect(await host.request({ type: "status" })).toMatchObject({ kind: "unenrolled" });
  });

  it("run from a register file, writes the registration into it and boots", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shopper-till-enrol-"));
    const config = await unenrolledConfig(directory);
    const path = join(directory, "register.json");
    await writeFile(path, JSON.stringify(config));
    const child = spawn(
      process.execPath,
      [resolve(`apps/till/host/${e2eRun.outDir}/server.js`), path],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    cleanup.push(async () => {
      child.kill("SIGTERM");
    });
    const lines = readyLines(child.stdout);
    const first = await lines.next();
    const browser = await connectBrowser(first, ORIGIN);
    expect(await browser.ask({ type: "status" })).toMatchObject({ kind: "unenrolled" });
    const challenge = await devices.issueEnrollment(principal, { branchId: ids.branch });
    await browser.ask({
      type: "device.enrol",
      shopCode: await slug(),
      code: challenge.code,
      name: "Back till",
    });
    const second = await lines.next();
    expect(second).toMatchObject({ port: first.port, capability: first.capability });
    const stored = JSON.parse(await readFile(path, "utf8"));
    expect(stored).toMatchObject({
      identity: { orgId: context.orgId, registerName: "Back till" },
      deviceToken: expect.stringMatching(/^[a-f0-9]{64}$/),
      upstream: api.url,
    });
  });
});

/** What an installer writes: where the till keeps its data, the API it talks to, and no identity yet. */
async function unenrolledConfig(directory?: string) {
  const folder = directory ?? (await mkdtemp(join(tmpdir(), "shopper-till-enrol-")));
  cleanup.push(() => rm(folder, { recursive: true, force: true }));
  return {
    sqlitePath: join(folder, "till.sqlite"),
    plaintext: true,
    upstream: api.url,
    origins: [ORIGIN],
    port: 0,
  };
}

async function slug() {
  const [row] = await databases()
    .db.select({ slug: org.slug })
    .from(org)
    .where(eq(org.id, context.orgId));
  return row!.slug;
}

/** The host prints each ready message as a JSON line when it runs without a parent. */
function readyLines(stream: NodeJS.ReadableStream | null) {
  const queued: Record<string, unknown>[] = [];
  const waiting: ((ready: Record<string, unknown>) => void)[] = [];
  let buffer = "";
  stream?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const message = JSON.parse(line) as Record<string, unknown>;
      if (message.type !== "ready") continue;
      const next = waiting.shift();
      if (next) next(message);
      else queued.push(message);
    }
  });
  return {
    next: () =>
      new Promise<{ port: number; capability: string; appVersion: string; protocol: number }>(
        (resolveReady) => {
          const ready = queued.shift();
          if (ready) return resolveReady(ready as never);
          waiting.push(resolveReady as never);
        },
      ),
  };
}
