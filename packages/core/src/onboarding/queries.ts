import { eq, sql, type SQL } from "drizzle-orm";
import {
  branch,
  deviceCredential,
  invitation,
  onboarding,
  org,
  product,
  store,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import type { SetupStep } from "./types";

/** The setup steps in wizard order. */
export const setupSteps = ["store", "branch", "tax", "products", "team", "till"] as const;

/**
 * Where a shop stands, read from the rows each step makes: a store, a branch, a TIN, a product (or a skipped
 * Products step), an invitation, and an enrolled register. Nothing is stored twice.
 */
export async function readSetup(db: ShopperDatabase | ShopperTransaction, orgId: string) {
  const [row] = await db
    .select({
      tin: org.tin,
      vatRegisteredFrom: org.vatRegisteredFrom,
      stores: exists(sql`SELECT 1 FROM ${store} WHERE ${store.orgId} = ${orgId}`),
      branches: exists(sql`SELECT 1 FROM ${branch} WHERE ${branch.orgId} = ${orgId}`),
      products: exists(sql`SELECT 1 FROM ${product} WHERE ${product.orgId} = ${orgId}`),
      invitations: exists(sql`SELECT 1 FROM ${invitation} WHERE ${invitation.orgId} = ${orgId}`),
      registers: exists(
        sql`SELECT 1 FROM ${deviceCredential} WHERE ${deviceCredential.orgId} = ${orgId} AND ${deviceCredential.revokedAt} IS NULL`,
      ),
      onboarding,
    })
    .from(org)
    .leftJoin(onboarding, eq(onboarding.orgId, org.id))
    .where(eq(org.id, orgId));
  if (!row) throw new Error("Org not found");
  const done: Record<SetupStep, boolean> = {
    store: row.stores,
    branch: row.branches,
    // A shop that is not VAT-registered has no TIN to give.
    tax: Boolean(row.tin) || !row.vatRegisteredFrom,
    products: row.products || Boolean(row.onboarding?.catalogueAt),
    team: row.invitations,
    till: row.registers,
  };
  return {
    steps: setupSteps.map((step) => ({ step, done: done[step] })),
    next: setupSteps.find((step) => !done[step]) ?? null,
    status: row.onboarding?.status ?? null,
    skipped: Boolean(row.onboarding?.wizardSkippedAt),
    finished: Boolean(row.onboarding?.wizardDoneAt),
    firstSaleAt: row.onboarding?.firstSaleAt?.toISOString() ?? null,
  };
}

const exists = (query: SQL) => sql<boolean>`EXISTS (${query})`;
