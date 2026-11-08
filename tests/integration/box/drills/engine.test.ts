// Notion Day 39 drill: kill the Rivet engine mid-batch → it is restarted, and nothing the shop depends on is lost. The
// engine runs in a container of its own whose restart policy stands in for systemd's Restart=always (the machine test
// checks the real unit). Its process is killed from the host, as a crash would, while a register uploads a backlog.
// PostgreSQL is the record: every sale lands once, sequences and the audit chain stay whole, and the restarted engine
// takes new work from the same box.
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { sale } from "@shopper/db-pg";
import { databases } from "../../../support/till/server";
import { createHostFixture } from "../../../support/till/host/fixture";
import { expectConverged, sell, waitForDrained } from "../../../support/till/host/chaos";
import { drillBox, expectStillSelling } from "../../../support/box/drill";
import { freePort } from "../../../support/box/sealed";

const name = `shopper-drill-engine-${process.pid}`;
const docker = (...args: string[]) =>
  execFileSync("docker", args, { timeout: 120_000 }).toString().trim();
const enginePid = () => docker("inspect", "-f", "{{.State.Pid}}", name);
let endpoint: string;
let box: Awaited<ReturnType<typeof drillBox>>;
let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;

async function engineReady() {
  for (let waited = 0; waited < 120_000; waited += 500) {
    if ((await fetch(`${endpoint}/health`).catch(() => undefined))?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The engine never answered");
}

beforeAll(async () => {
  const port = await freePort();
  endpoint = `http://127.0.0.1:${port}`;
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--restart=always",
    "-p",
    `127.0.0.1:${port}:6420`,
    "-e",
    "RIVET__STORAGE__LOG_DIRECTORY=/data",
    "-e",
    "RIVET__STORAGE__AUTO_PROVISION_PARTITIONS=true",
    "-e",
    "RIVET__OBJECT_STORAGE__PRIMARY__FILE_SYSTEM__PATH=/data/objects",
    "-e",
    "RIVET__AUTH__ADMIN_TOKEN=drill_engine_token",
    "rivetdev/engine:3.0.0-preview.3",
  );
  await engineReady();
  box = await drillBox({
    RIVET_ENDPOINT: endpoint,
    RIVET_TOKEN: "drill_engine_token",
    RIVET_POOL: "drill",
  });
}, 400_000);
afterAll(async () => {
  await fixture?.close();
  await box?.close();
  docker("rm", "-f", name);
});

const onBox = async () =>
  (
    await databases()
      .db.select({ id: sale.id })
      .from(sale)
      .where(eq(sale.orgId, databases().context.orgId))
  ).length;

test("the engine crashes mid-batch: the register keeps selling, the engine comes back and the books are whole", async () => {
  fixture = await createHostFixture({ upstream: box.upstream, freshSession: true });
  const host = await fixture.start();
  const selling = sell(host, fixture.config.references.products[0]!.id, 80);
  await expect.poll(onBox, { timeout: 60_000, interval: 50 }).toBeGreaterThan(5);
  const before = enginePid();
  // The container's process belongs to root: CI's runner user needs sudo, a root dev box does not.
  execFileSync("sh", ["-c", `kill -9 ${before} 2>/dev/null || sudo -n kill -9 ${before}`]);

  await selling;
  for (let round = 0; round < 5; round++) await expectStillSelling(fixture, host);
  await expect
    .poll(() => (enginePid() !== before && enginePid() !== "0" ? "restarted" : "down"), {
      timeout: 60_000,
      interval: 500,
    })
    .toBe("restarted");
  expect(Number(docker("inspect", "-f", "{{.RestartCount}}", name))).toBeGreaterThanOrEqual(1);
  await engineReady();

  void host.request({ type: "retry" }, 30_000).catch(() => undefined);
  await waitForDrained(host, 120_000);
  await expectConverged(fixture);
  expect(await onBox()).toBe(85);
  // The same box gives the restarted engine new work: a workflow runs to its first step.
  expect(
    execFileSync(`${box.home}/shopper-box`, ["doctor"], {
      env: {
        PATH: process.env.PATH ?? "",
        RIVET_ENDPOINT: endpoint,
        RIVET_TOKEN: "drill_engine_token",
        RIVET_POOL: "drill-after",
      },
      timeout: 120_000,
    }).toString(),
  ).toContain('"engine":"rivet"');
}, 600_000);
