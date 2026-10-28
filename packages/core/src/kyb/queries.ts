import { eq } from "drizzle-orm";
import { kybCase, type ShopperDatabase } from "@shopper/db-pg";

/** The owner's view of the shop's case; a shop that never started one sees an empty draft. */
export async function readKyb(db: ShopperDatabase, orgId: string) {
  const [row] = await db.select().from(kybCase).where(eq(kybCase.orgId, orgId));
  return {
    status: row?.status ?? "draft",
    version: row?.version ?? 0,
    businessName: row?.businessName ?? null,
    registrationNumber: row?.registrationNumber ?? null,
    tin: row?.tin ?? null,
    settlementBank: row?.settlementBank ?? null,
    settlementAccount: row?.settlementAccount ?? null,
    directors: row?.directors ?? [],
    documents: row?.documents ?? [],
    checks: row?.checks ?? [],
    submittedAt: row?.submittedAt?.toISOString() ?? null,
    decisionNote: row?.decisionNote ?? null,
    decidedAt: row?.decidedAt?.toISOString() ?? null,
    expiresOn: row?.expiresOn ?? null,
    payouts: Boolean(row?.subaccountCode),
  };
}
