// One shop's full picture for Shopper staff debugging it: who owns it, its stores with their branches and registers
// and when each was last seen, its catalogue, staff, verification and workflows, billing, and recent audit rows.
// Read-only, and only for platform staff holding `platform.tenant.read`.
import { beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { money } from "@shopper/money";
import { asStaff, context, cookies, db, tenantApi } from "./support";
import { request, roleIds } from "../auth/setup";

const path = () => `/platform/tenants/${context.orgId}`;
const seen = new Date("2026-11-10T09:30:00Z");
let deviceId: string;

beforeAll(async () => {
  const [store] = await db
    .insert(schema.store)
    .values({ orgId: context.orgId, name: "Osu" })
    .returning();
  const [branch] = await db
    .insert(schema.branch)
    .values({ orgId: context.orgId, storeId: store!.id, name: "Osu main" })
    .returning();
  const [device] = await db
    .insert(schema.device)
    .values({ orgId: context.orgId, branchId: branch!.id, name: "Till 1" })
    .returning();
  deviceId = device!.id;
  await db
    .insert(schema.device)
    .values({ orgId: context.orgId, branchId: branch!.id, name: "Till 2" });
  const [owner] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(
      and(eq(schema.user.orgId, context.orgId), eq(schema.user.email, "same-owner@example.com")),
    );
  await db.insert(schema.cashierSession).values({
    orgId: context.orgId,
    deviceId,
    branchId: branch!.id,
    userId: owner!.id,
    roleId: roleIds.get("cashier")!,
    issuedAt: seen,
    expiresAt: new Date(seen.getTime() + 3_600_000),
  });
  const [tax] = await db
    .select({ id: schema.taxClass.id })
    .from(schema.taxClass)
    .where(eq(schema.taxClass.orgId, context.orgId));
  await db.insert(schema.product).values(
    ["Milo", "Ideal milk", "Old rice"].map((name, index) => ({
      orgId: context.orgId,
      sku: `SKU-${index}`,
      name,
      taxClassId: tax!.id,
      baseUnit: "each" as const,
      archivedAt: name === "Old rice" ? seen : null,
    })),
  );
  await db.insert(schema.subscription).values({
    orgId: context.orgId,
    status: "past_due",
    billingDay: 5,
    nextInvoiceOn: "2026-12-05",
  });
  await db.insert(schema.invoice).values({
    orgId: context.orgId,
    reference: "inv-tenant-test",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
    stores: 1,
    terminals: 2,
    amount: money(8_500_000),
    reminders: 1,
  });
  await db.insert(schema.workflowRun).values({
    orgId: context.orgId,
    instanceId: `kyb:${context.orgId}`,
    businessKey: `kyb:${context.orgId}`,
    type: "kyb",
    status: "waiting",
    currentStep: "review",
  });
});

test("staff see one shop's overview, stores, products, staff, verification, billing and activity", async () => {
  const reply = await asStaff(path());
  expect(reply.status).toBe(200);
  const body = await reply.json();

  expect(body.overview).toMatchObject({
    id: context.orgId,
    name: "Auth tenant",
    owner: { name: expect.any(String), email: "same-owner@example.com" },
    counts: { stores: 1, branches: 1, devices: 2, products: 2, archived: 1, members: 5 },
  });
  expect(body.stores).toEqual([
    expect.objectContaining({
      name: "Osu",
      branches: [
        expect.objectContaining({
          name: "Osu main",
          devices: [
            expect.objectContaining({
              id: deviceId,
              name: "Till 1",
              lastSeenAt: seen.toISOString(),
            }),
            expect.objectContaining({ name: "Till 2", lastSeenAt: null }),
          ],
        }),
      ],
    }),
  ]);
  expect(body.products).toMatchObject({ active: 2, archived: 1 });
  expect(body.products.sample.map((product: { name: string }) => product.name).sort()).toEqual([
    "Ideal milk",
    "Milo",
    "Old rice",
  ]);
  expect(body.staff.members).toHaveLength(5);
  expect(body.staff.members).toContainEqual(
    expect.objectContaining({ email: "cashier@example.com", role: "cashier", active: true }),
  );
  expect(body.staff.invitations).toEqual([]);
  expect(body.verification).toMatchObject({
    kyb: null,
    workflows: [expect.objectContaining({ type: "kyb", status: "waiting", currentStep: "review" })],
  });
  expect(body.billing).toMatchObject({
    subscription: { status: "past_due", billingDay: 5, nextInvoiceOn: "2026-12-05" },
    invoices: [expect.objectContaining({ reference: "inv-tenant-test", amount: 8_500_000 })],
  });
  // Registering the staff wrote audit rows; the newest come first.
  expect(body.activity.length).toBeGreaterThan(0);
  expect(body.activity[0]).toMatchObject({ command: expect.any(String), at: expect.any(String) });
  expect(body.activity.map((row: { command: string }) => row.command)).toContain(
    "auth.user.register",
  );
});

test("a shop that does not exist is a 404, and an id that is not one is refused", async () => {
  expect((await asStaff("/platform/tenants/01900000-0000-7000-8000-000000000000")).status).toBe(
    404,
  );
  expect((await asStaff("/platform/tenants/not-an-id")).status).toBe(400);
});

test("a shop's owner and a platform member without the permission are refused", async () => {
  expect((await request(tenantApi, cookies.get("superadmin")!, path())).status).toBe(403);
  expect((await asStaff(path(), "GET", undefined, "cashier")).status).toBe(403);
});
