import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { kybCase, onboarding, org, product, type ShopperDatabase } from "@shopper/db-pg";
import { readBilling } from "../../billing/queries";
import { ManagementError } from "../../management";
import { tenantActivity, tenantWorkflows } from "./history";
import { tenantStaff } from "./people";
import { tenantStores } from "./stores";

/**
 * One shop as Shopper staff debugging it see it: who owns it and its headline counts, its stores with their
 * branches and registers, a sample of its catalogue, its staff, verification and workflows, billing, and the newest
 * audit rows. Read-only; every section is bounded so a large shop still answers quickly.
 */
export async function platformTenant(db: ShopperDatabase, orgId: string) {
  const [shop] = await db
    .select({
      id: org.id,
      name: org.name,
      code: org.slug,
      mode: org.mode,
      updateChannel: org.updateChannel,
      createdAt: org.createdAt,
      onboarding: onboarding.status,
      firstSaleAt: onboarding.firstSaleAt,
    })
    .from(org)
    .leftJoin(onboarding, eq(onboarding.orgId, org.id))
    .where(eq(org.id, orgId));
  if (!shop) throw new ManagementError("No shop with that id", 404);
  const [stores, staff, products, verification, billing, activity] = await Promise.all([
    tenantStores(db, orgId),
    tenantStaff(db, orgId),
    tenantProducts(db, orgId),
    tenantVerification(db, orgId),
    readBilling(db, orgId),
    tenantActivity(db, orgId),
  ]);
  const branches = stores.flatMap((store) => store.branches);
  return {
    overview: {
      ...shop,
      createdAt: shop.createdAt.toISOString(),
      firstSaleAt: shop.firstSaleAt?.toISOString() ?? null,
      owner: staff.owner,
      counts: {
        stores: stores.length,
        branches: branches.length,
        devices: branches.flatMap((branch) => branch.devices).length,
        products: products.active,
        archived: products.archived,
        members: staff.members.length,
        invitations: staff.invitations.filter((invitation) => invitation.status === "pending")
          .length,
      },
    },
    stores,
    products,
    staff: { members: staff.members, invitations: staff.invitations },
    verification,
    billing,
    activity,
  };
}

async function tenantProducts(db: ShopperDatabase, orgId: string) {
  const total = (archived: boolean) =>
    db
      .select({ n: count() })
      .from(product)
      .where(
        and(
          eq(product.orgId, orgId),
          archived ? isNotNull(product.archivedAt) : isNull(product.archivedAt),
        ),
      )
      .then(([row]) => row?.n ?? 0);
  const [active, archived, sample] = await Promise.all([
    total(false),
    total(true),
    db
      .select({
        id: product.id,
        sku: product.sku,
        name: product.name,
        onlineVisible: product.onlineVisible,
        archivedAt: product.archivedAt,
        updatedAt: product.updatedAt,
      })
      .from(product)
      .where(eq(product.orgId, orgId))
      .orderBy(desc(product.updatedAt))
      .limit(25),
  ]);
  return {
    active,
    archived,
    sample: sample.map((row) => ({
      ...row,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

async function tenantVerification(db: ShopperDatabase, orgId: string) {
  const [[kyb], workflows] = await Promise.all([
    db
      .select({
        status: kybCase.status,
        version: kybCase.version,
        businessName: kybCase.businessName,
        checks: kybCase.checks,
        submittedAt: kybCase.submittedAt,
        decidedAt: kybCase.decidedAt,
        decisionNote: kybCase.decisionNote,
        expiresOn: kybCase.expiresOn,
        payouts: kybCase.subaccountCode,
      })
      .from(kybCase)
      .where(eq(kybCase.orgId, orgId)),
    tenantWorkflows(db, orgId),
  ]);
  return {
    kyb: kyb
      ? {
          ...kyb,
          submittedAt: kyb.submittedAt?.toISOString() ?? null,
          decidedAt: kyb.decidedAt?.toISOString() ?? null,
          payouts: Boolean(kyb.payouts),
        }
      : null,
    workflows,
  };
}
