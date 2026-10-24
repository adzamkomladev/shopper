import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import * as v from "valibot";
import { kycCase, org, type ShopperDatabase } from "@shopper/db-pg";
import type { kycListQuery } from "../schemas/kyc";
import { readCaseRow } from "./records";
import type { KycCaseRow } from "./types";

const LIST_LIMIT = 200;

/** What a client sees of a case. The ID number is not on the row to begin with: only its mask is. */
export const kycView = (row: KycCaseRow) => ({
  id: row.id,
  purpose: row.purpose,
  status: row.status,
  customerId: row.customerId,
  memberId: row.memberId,
  phone: row.phone,
  requestedLimit: row.requestedLimit,
  requestedRoleId: row.requestedRoleId,
  idType: row.idType,
  idMasked: row.idMasked,
  fullName: row.fullName,
  idSighted: row.idSighted,
  approvedLimit: row.approvedLimit,
  approvedRoleId: row.approvedRoleId,
  decisionNote: row.decisionNote,
  decidedAt: row.decidedAt?.toISOString() ?? null,
  decisionDueAt: row.decisionDueAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

/** A case with the other subjects' cases that carry the same ID fingerprint, so an approver can see a shared document. */
export async function readKycCase(db: ShopperDatabase, orgId: string, id: string) {
  const row = await readCaseRow(db, orgId, id);
  const duplicates = row.idFingerprint
    ? await db
        .select({ caseId: kycCase.id, customerId: kycCase.customerId, memberId: kycCase.memberId })
        .from(kycCase)
        .where(
          and(
            eq(kycCase.orgId, orgId),
            eq(kycCase.idFingerprint, row.idFingerprint),
            ne(kycCase.id, row.id),
            or(
              sql`${kycCase.customerId} IS DISTINCT FROM ${row.customerId}`,
              sql`${kycCase.memberId} IS DISTINCT FROM ${row.memberId}`,
            ),
          ),
        )
        .orderBy(kycCase.createdAt)
    : [];
  return { ...kycView(row), duplicates };
}

export async function listKycCases(
  db: ShopperDatabase,
  orgId: string,
  query: v.InferOutput<typeof kycListQuery>,
) {
  const rows = await db
    .select()
    .from(kycCase)
    .where(
      and(eq(kycCase.orgId, orgId), query.status ? eq(kycCase.status, query.status) : undefined),
    )
    .orderBy(desc(kycCase.createdAt))
    .limit(LIST_LIMIT);
  return { items: rows.map(kycView) };
}

export async function readKycSettings(db: ShopperDatabase, orgId: string) {
  const [row] = await db
    .select({ idRequired: org.kycIdRequired, idTypes: org.kycIdTypes })
    .from(org)
    .where(eq(org.id, orgId));
  // Reached only with an org that has a session, so its row exists.
  return row!;
}
