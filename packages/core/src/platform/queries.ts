import { asc, desc, eq, ne } from "drizzle-orm";
import { kybCase, kybStatuses, onboarding, org, type ShopperDatabase } from "@shopper/db-pg";
import { ManagementError } from "../management";

/** Every shop but the platform's own, newest first, with where it stands in onboarding and verification. */
export function platformTenants(db: ShopperDatabase, platformOrgId: string) {
  return db
    .select({
      id: org.id,
      name: org.name,
      code: org.slug,
      createdAt: org.createdAt,
      onboarding: onboarding.status,
      firstSaleAt: onboarding.firstSaleAt,
      kybStatus: kybCase.status,
      payouts: kybCase.subaccountCode,
    })
    .from(org)
    .leftJoin(onboarding, eq(onboarding.orgId, org.id))
    .leftJoin(kybCase, eq(kybCase.orgId, org.id))
    .where(ne(org.id, platformOrgId))
    .orderBy(desc(org.createdAt))
    .limit(500)
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        firstSaleAt: row.firstSaleAt?.toISOString() ?? null,
        payouts: Boolean(row.payouts),
      })),
    );
}

/** The cases at one status, the longest-waiting first. */
export function kybQueue(db: ShopperDatabase, status: (typeof kybStatuses)[number]) {
  return db
    .select({
      orgId: kybCase.orgId,
      shop: org.name,
      businessName: kybCase.businessName,
      status: kybCase.status,
      version: kybCase.version,
      submittedAt: kybCase.submittedAt,
      expiresOn: kybCase.expiresOn,
      payouts: kybCase.subaccountCode,
    })
    .from(kybCase)
    .innerJoin(org, eq(org.id, kybCase.orgId))
    .where(eq(kybCase.status, status))
    .orderBy(asc(kybCase.submittedAt))
    .limit(500)
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        payouts: Boolean(row.payouts),
      })),
    );
}

/** One shop's case as a reviewer sees it. */
export async function kybCaseFor(db: ShopperDatabase, orgId: string) {
  const [row] = await db
    .select({ shop: org.name, code: org.slug, case: kybCase })
    .from(kybCase)
    .innerJoin(org, eq(org.id, kybCase.orgId))
    .where(eq(kybCase.orgId, orgId));
  if (!row) throw new ManagementError("No verification for that shop", 404);
  return {
    ...row.case,
    shop: row.shop,
    code: row.code,
    createdAt: row.case.createdAt.toISOString(),
    updatedAt: row.case.updatedAt.toISOString(),
    submittedAt: row.case.submittedAt?.toISOString() ?? null,
    decidedAt: row.case.decidedAt?.toISOString() ?? null,
    renewalSentAt: row.case.renewalSentAt?.toISOString() ?? null,
    payouts: Boolean(row.case.subaccountCode),
  };
}
