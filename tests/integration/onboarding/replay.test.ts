// Cloudflare replays a hibernated workflow from its cached steps with today's clock. Branches must follow the time the
// step read the row, or a shop provisioned on day one is abandoned when its run replays a month later.
import { expect, test } from "vite-plus/test";
import { and, eq, like } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxAuthFlows, boxOnboardingFlows } from "@shopper/adapters-box";
import { createLinkToken, createOnboarding } from "@shopper/auth";
import { onboardingId, runOnboarding } from "@shopper/core/onboarding";
import { WorkflowTimeoutError, type Json } from "@shopper/ports";
import { db, DAY } from "../../support/onboarding/world";

const secret = "onboarding workflow secret with thirty two characters";
const suspended = new Error("suspended");

/** One engine run over a durable cache: cached steps and waits return, the first unresolved wait suspends. */
function replay(
  instanceId: string,
  cache: Map<string, unknown>,
  waits: Map<string, "wake" | "timeout">,
) {
  return {
    instanceId,
    async step<T>(name: string, _policy: unknown, run: () => Promise<T>) {
      if (cache.has(name)) return cache.get(name) as T;
      const output = await run();
      cache.set(name, output);
      return output;
    },
    async waitFor(name: string): Promise<Json> {
      const outcome = waits.get(name);
      if (outcome === "wake") return {};
      if (outcome === "timeout") throw new WorkflowTimeoutError(instanceId, name, "wake", 0);
      throw suspended;
    },
  };
}

test("a provisioned shop replayed after its signup expiry is not abandoned", async () => {
  const authFlows = boxAuthFlows({
    withDatabase: (run) => run(db),
    linkSecret: secret,
    baseURL: "http://shopper.test",
  });
  const service = createOnboarding({
    database: db,
    linkSecret: secret,
    baseURL: "http://shopper.test",
    launcher: authFlows,
  });
  const started = await service.start({
    name: "Kofi",
    email: `${crypto.randomUUID()}@example.com`,
    shopName: "Kofi Mart",
    shopCode: `kofi-${Date.now()}`,
  });
  const id = started.id;
  const token = await createLinkToken(secret, "registration", id);
  const cache = new Map<string, unknown>();
  const waits = new Map<string, "wake" | "timeout">();
  const signedUp = Date.now();
  const run = (at: number) =>
    runOnboarding(
      replay(onboardingId(id), cache, waits),
      { withDatabase: (fn) => fn(db), appVersion: "test", now: () => at },
      { orgId: id },
    ).catch((error: unknown) => {
      if (error !== suspended) throw error;
    });

  await run(signedUp);
  await service.verify({ id, token });
  await service.complete({ id, token, password: "onboarding-password-123" });
  waits.set("registration-wait-0", "wake");
  await run(signedUp + 60_000);
  expect(cache.has("provisioned")).toBe(true);

  waits.set("shop-wait-0", "timeout");
  await run(signedUp + 25 * DAY);
  expect(cache.has("abandon")).toBe(false);
  expect(cache.has("shop-1")).toBe(true);
  const abandoned = await db
    .select()
    .from(schema.registrationAuditLog)
    .where(
      and(
        eq(schema.registrationAuditLog.orgId, id),
        like(schema.registrationAuditLog.command, "%abandon"),
      ),
    );
  expect(abandoned).toHaveLength(0);
});

test("a launch that fails at signup is recovered when the owner verifies", async () => {
  const flows = boxOnboardingFlows({ withDatabase: (fn) => fn(db), appVersion: "test" });
  const launched: string[] = [];
  let down = true;
  const service = createOnboarding({
    database: db,
    linkSecret: secret,
    baseURL: "http://shopper.test",
    launcher: boxAuthFlows({
      withDatabase: (fn) => fn(db),
      linkSecret: secret,
      baseURL: "http://shopper.test",
    }),
    onboarding: {
      async start(id, params) {
        if (down) throw new Error("binding unavailable");
        launched.push(id);
        await flows.start(id, params);
      },
      send: (id, type, payload) => flows.send(id, type, payload),
    },
  });
  const started = await service.start({
    name: "Esi",
    email: `${crypto.randomUUID()}@example.com`,
    shopName: "Esi Mart",
    shopCode: `esi-${Date.now()}`,
  });
  expect(started.resendToken).toBeTruthy();
  down = false;
  await service.verify({
    id: started.id,
    token: await createLinkToken(secret, "registration", started.id),
  });
  expect(launched).toEqual([onboardingId(started.id)]);
});
