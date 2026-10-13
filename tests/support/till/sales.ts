import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ids } from "../../fixtures/sales/golden";

export { foreignProduct, goldenSale, ids, references } from "../../fixtures/sales/golden";
export const appVersion = "0.1.0-test";
export const config = {
  orgId: ids.org,
  deviceId: ids.device,
  storeId: "019a0000-0000-7000-8000-00000000000d",
  branchId: ids.branch,
  appVersion,
  now: () => new Date("2025-12-31T23:30:00.000Z"),
};
export const session = {
  id: ids.session,
  orgId: ids.org,
  deviceId: ids.device,
  branchId: ids.branch,
  userId: ids.cashier,
  roleName: "Cashier",
  issuedAt: "2025-12-31T16:00:00.000Z",
  expiresAt: "2026-01-01T08:00:00.000Z",
  permissions: ["sale.create"],
  proof: "private-cashier-proof",
};
export const context = {
  orgId: ids.org,
  actorId: ids.cashier,
  role: "Cashier",
  deviceId: ids.device,
  branchId: ids.branch,
  appVersion,
};

export async function withDatabase<T>(run: (path: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "shopper-till-sale-"));
  try {
    return await run(join(dir, "till.sqlite"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
