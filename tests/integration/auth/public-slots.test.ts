import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { asc, eq } from "drizzle-orm";
import { serveRuntime } from "@shopper/api/runtime";
import { verifyChain } from "@shopper/audit";
import * as schema from "@shopper/db-pg";
import { authLauncherFixture } from "../../support/workflows/fixture";
import { serveHono, type HttpClient } from "../../support/till/http";
import { baseURL, context, cookies, db, deviceCache, fixture, roleIds, secret } from "./setup";
import { waitForPublicSlot } from "../../support/publicauth/slots";

const countFile = "tests/e2e/.auth/public-requests.json";
const linkSecret = "public invite slot secret with at least thirty two characters";
let previousCountFile: string | undefined;
let host: HttpClient;
let workflows: ReturnType<typeof authLauncherFixture>;
let links: { id: string; token: string }[];
let acceptTimes: number[] = [];

beforeAll(async () => {
  if (existsSync(countFile)) previousCountFile = readFileSync(countFile, "utf8");
  mkdirSync(dirname(countFile), { recursive: true });
  writeFileSync(countFile, JSON.stringify({ count: 0, start: 0 }));
  workflows = authLauncherFixture(fixture.connectionString, { linkSecret, baseURL });
  host = await serveHono({
    fetch: (request) =>
      serveRuntime(request, {
        database: db,
        cache: deviceCache.cache,
        secret,
        baseURL,
        orgId: context.orgId,
        clientIP: "198.51.100.240",
        authFlows: workflows.launcher,
        linkSecret,
      }),
  });
  links = [];
  for (let index = 0; index < 5; index += 1) links.push(await invite(index));
});

afterAll(async () => {
  vi.useRealTimers();
  await host?.close();
  await workflows?.close();
  if (previousCountFile === undefined) rmSync(countFile, { force: true });
  else writeFileSync(countFile, previousCountFile);
});

test("public invitation fixtures respect shifted server rate-limit windows", async () => {
  const start = Date.now();
  acceptTimes = [];
  vi.useFakeTimers({ now: start });
  const statuses = [await accept(links[0]!, 0)];
  await vi.advanceTimersByTimeAsync(11_000);
  statuses.push(await accept(links[1]!, 1));
  await vi.advanceTimersByTimeAsync(100);
  statuses.push(await accept(links[2]!, 2));
  await vi.advanceTimersByTimeAsync(2_000);

  const fourth = accept(links[3]!, 3);
  await Promise.resolve();
  const waitedForWindow = acceptTimes.length === 3;
  if (waitedForWindow) {
    await vi.advanceTimersByTimeAsync(10_999);
    expect(acceptTimes).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
  }
  statuses.push(await fourth);
  await vi.advanceTimersByTimeAsync(100);
  statuses.push(await accept(links[4]!, 4));

  expect(statuses).toEqual([200, 200, 200, 200, 200]);
  expect(waitedForWindow).toBe(true);
  expect(Date.now()).toBe(start + 24_200);
  expect(acceptTimes).toEqual([
    start,
    start + 11_000,
    start + 11_100,
    start + 24_100,
    start + 24_200,
  ]);
  const users = await db
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.orgId, context.orgId));
  expect(
    users
      .map((row) => row.email)
      .filter((email) => email.startsWith("public-slot-"))
      .sort(),
  ).toEqual(
    links.map((_, index) => `public-slot-${index}@public-slots.integration.invalid`).sort(),
  );
  const auditRows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(asc(schema.auditLog.chainSeq));
  expect(auditRows.filter((row) => row.command === "auth.invitation.accept")).toHaveLength(5);
  expect(await verifyChain(auditRows)).toMatchObject({ valid: true, count: auditRows.length });
});

async function invite(index: number) {
  const response = await host.request("/invitations", {
    method: "POST",
    headers: {
      cookie: cookies.get("superadmin")!,
      "X-Shopper-Org": context.orgId,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: `public-slot-${index}@public-slots.integration.invalid`,
      roleId: roleIds.get("cashier"),
      channel: "local",
    }),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  const invitation = (await response.json()) as { id: string; setupLink: string };
  const url = new URL(invitation.setupLink);
  return { id: invitation.id, token: url.searchParams.get("token")! };
}

async function accept(link: { id: string; token: string }, index: number) {
  await waitForPublicSlot();
  acceptTimes.push(Date.now());
  const response = await host.request(`/invitations/${link.id}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: link.token,
      name: `Staff ${index}`,
      password: "staff-password-123",
    }),
  });
  return response.status;
}
