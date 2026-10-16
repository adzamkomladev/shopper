import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { auditLog, payment } from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { momoFixture } from "../../support/payments/momo";

let f: Awaited<ReturnType<typeof momoFixture>>;
beforeAll(async () => {
  f = await momoFixture();
});
afterAll(async () => f?.close());
const charge = (reference: string, phone: string) =>
  f.call("/payments/momo", "POST", { reference, phone, network: "mtn", amount: 10_000 });

test("a changed full phone sharing the displayed suffix cannot reuse a charge reference", async () => {
  const reference = v7();
  try {
    expect((await charge(reference, "0241234567")).status).toBe(201);
    await vi.waitFor(() =>
      expect(
        f.fake.requests.some(
          (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
        ),
      ).toBe(true),
    );
    expect((await charge(reference, "0541234567")).status).toBe(409);
    expect(
      f.fake.requests.filter(
        (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
      ),
    ).toHaveLength(1);
  } finally {
    await f.webhook(reference);
  }
});

test("equivalent Ghana phone formats retry one charge and keep the fingerprint private", async () => {
  const reference = v7();
  try {
    const first = await charge(reference, "0241234567");
    expect(first.status).toBe(201);
    expect(await first.json()).not.toHaveProperty("phoneFingerprint");
    expect((await charge(reference, "+233241234567")).status).toBe(201);
    await vi.waitFor(() =>
      expect(
        f.fake.requests.filter(
          (r) => r.path === "/charge" && (r.body as { reference: string }).reference === reference,
        ),
      ).toHaveLength(1),
    );
    const [row] = await f.db.select().from(payment).where(eq(payment.reference, reference));
    expect(row).toMatchObject({
      phone: "******4567",
      phoneFingerprint: await sha256("0241234567"),
    });
    const audit = await f.db.select().from(auditLog).where(eq(auditLog.orgId, f.orgId));
    expect(JSON.stringify(audit)).not.toContain("0241234567");
    expect(JSON.stringify(audit)).not.toContain("+233241234567");
  } finally {
    await f.webhook(reference);
  }
});

test("migration replay preserves masked legacy intents and refuses an unprovable retry identity", async () => {
  const { defineCommand } = await import("@shopper/audit");
  const { readFile } = await import("node:fs/promises");
  const reference = v7();
  try {
    expect((await charge(reference, "0241234567")).status).toBe(201);
    await defineCommand({
      name: "test.payment.legacy",
      async run(tx) {
        await tx
          .update(payment)
          .set({ phoneFingerprint: null })
          .where(eq(payment.reference, reference));
        return { reference };
      },
      audit: () => ({ reference }),
    })(f.db, { orgId: f.orgId, appVersion: "test" }, undefined);
    const migration = await readFile(
      new URL("../../../packages/db/pg/migrations/0017_payment_fingerprint.sql", import.meta.url),
      "utf8",
    );
    for (let replay = 0; replay < 2; replay++)
      await f.fixture.client.query(migration.replaceAll("--> statement-breakpoint", ""));
    const [row] = await f.db.select().from(payment).where(eq(payment.reference, reference));
    expect(row).toMatchObject({ phone: "******4567", phoneFingerprint: null });
    expect((await charge(reference, "0241234567")).status).toBe(409);
  } finally {
    await f.webhook(reference);
  }
});
