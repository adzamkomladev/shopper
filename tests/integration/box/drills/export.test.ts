// Notion Day 41 on the box: one click gives the owner a complete, verifiable copy of the business, made on the box
// with no route to the internet. The sealed binary runs the archive as a workflow, the owner's browser downloads the
// stream, and the file verifies with nothing but itself.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, count, eq } from "drizzle-orm";
import { auditLog, branch, device, org, product } from "@shopper/db-pg";
import { verifyArchive } from "@shopper/export/verify";
import { context, databases, principal } from "../../../support/till/server";
import { drillBox } from "../../../support/box/drill";
import { grantCashier, setCashierPassword, unplugInternet } from "../../../support/box/lan";

let internet: Awaited<ReturnType<typeof unplugInternet>>;
let box: Awaited<ReturnType<typeof drillBox>>;
let revoke: (() => Promise<unknown>) | undefined;
let cookie = "";
const origin = () => box.upstream.replace(/\/api$/, "");
const call = (path: string, init: RequestInit = {}) =>
  fetch(`${box.upstream}${path}`, {
    ...init,
    headers: { cookie, origin: origin(), "content-type": "application/json", ...init.headers },
  });

beforeAll(async () => {
  internet = await unplugInternet();
  box = await drillBox(internet.env);
  // The suite's cashier signs in to the back office as an owner would, holding the permission an owner grants.
  revoke = await grantCashier("export.run");
  await setCashierPassword(principal.userId, "export drill password");
  const signedIn = await fetch(`${box.upstream}/auth/sign-in/email`, {
    method: "POST",
    headers: { origin: origin(), "content-type": "application/json" },
    body: JSON.stringify({ email: "sync-cashier@test.invalid", password: "export drill password" }),
  });
  cookie = (signedIn.headers.get("set-cookie") ?? "").match(
    /(?:__Secure-)?better-auth\.session_token=[^;,]+/,
  )?.[0]!;
  expect(cookie, await signedIn.clone().text()).toBeTruthy();
}, 300_000);
afterAll(async () => {
  await revoke?.();
  await box?.close();
  await internet?.close();
});

test("the sealed box makes a complete archive with no internet, and it verifies from the file alone", async () => {
  const started = await call("/export/archives", { method: "POST", body: "{}" });
  expect(started.status, await started.clone().text()).toBe(202);
  const { id } = (await started.json()) as { id: string };
  let job: { status: string; error: string | null } = { status: "running", error: null };
  for (let waited = 0; job.status === "running" && waited < 90_000; waited += 500) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    job = (await (await call(`/export/archives/${id}`)).json()) as typeof job;
  }
  expect(job, box.output()).toMatchObject({ status: "ready" });

  const download = await call(`/export/archives/${id}/download`);
  expect(download.status).toBe(200);
  const bytes = new Uint8Array(await download.arrayBuffer());
  const result = await verifyArchive(bytes);
  if (!result.ok) throw new Error(result.message);
  expect(result.manifest.org.id).toBe(context.orgId);

  // The archive's counts are the box database's, table by table, for the tables nothing is writing to.
  const { db } = databases();
  const orgId = context.orgId;
  const rows = async (table: typeof branch | typeof device | typeof product | typeof org) =>
    (await db.select({ n: count() }).from(table).where(eq(table.orgId, orgId)))[0]!.n;
  expect(result.manifest.tables.branch!.rows).toBe(await rows(branch));
  expect(result.manifest.tables.device!.rows).toBe(await rows(device));
  expect(result.manifest.tables.org!.rows).toBe(1);

  // The owner's start and download are in the audit trail, and the box never tried to reach the internet.
  const commands = (
    await db
      .select({ command: auditLog.command })
      .from(auditLog)
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityId, id)))
  ).map((row) => row.command);
  expect(commands).toEqual(
    expect.arrayContaining([
      "export.archive.start",
      "export.archive.seal",
      "export.archive.download",
    ]),
  );
  expect(internet.attempts).toEqual([]);
}, 300_000);
