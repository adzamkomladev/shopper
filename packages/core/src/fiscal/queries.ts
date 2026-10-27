import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import * as v from "valibot";
import { branch, fiscalArchive, fiscalDoc, store, type ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import {
  fiscalArchiveQuery,
  fiscalDocId,
  fiscalListQuery,
  fiscalSegments,
} from "../schemas/fiscal/queries";
import { FiscalError } from "./error";
import { fiscalSigned } from "../changes/project";

/** Newest first; an org's dashboard shows the latest documents, searching finds older ones. */
const LIMIT = 200;
const SEGMENT_STATUSES = {
  pending: ["pending", "submitted"],
  accepted: ["accepted"],
  rejected: ["rejected"],
  dead: ["dead"],
} as const;

/** The fiscal dashboard: counts per segment and the documents of one, with why each stopped. */
export async function listFiscalDocs(
  db: ShopperDatabase,
  orgId: string,
  raw: unknown,
  branches?: string[],
) {
  const query = v.parse(fiscalListQuery, raw);
  const scope = and(
    eq(fiscalDoc.orgId, orgId),
    query.branch ? eq(fiscalDoc.branchId, query.branch) : undefined,
    branches ? inArray(fiscalDoc.branchId, branches) : undefined,
    query.q ? ilike(fiscalDoc.invoiceNumber, `%${query.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
  );
  const totals = await db
    .select({ status: fiscalDoc.status, count: sql<number>`count(*)::int` })
    .from(fiscalDoc)
    .where(scope)
    .groupBy(fiscalDoc.status);
  const count = (statuses: readonly string[]) =>
    totals.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row.count, 0);
  const rows = await db
    .select({ doc: fiscalDoc, branchName: branch.name })
    .from(fiscalDoc)
    .innerJoin(branch, and(eq(branch.orgId, fiscalDoc.orgId), eq(branch.id, fiscalDoc.branchId)))
    .where(
      and(
        scope,
        query.status === "all"
          ? undefined
          : inArray(fiscalDoc.status, [...SEGMENT_STATUSES[query.status]]),
      ),
    )
    .orderBy(desc(fiscalDoc.createdAt), desc(fiscalDoc.id))
    .limit(LIMIT);
  return {
    counts: Object.fromEntries(
      fiscalSegments.map((segment) => [
        segment,
        segment === "all"
          ? count(totals.map((row) => row.status))
          : count(SEGMENT_STATUSES[segment]),
      ]),
    ) as Record<(typeof fiscalSegments)[number], number>,
    documents: rows.map(({ doc, branchName }) => ({
      id: doc.id,
      kind: doc.kind,
      invoiceNumber: doc.invoiceNumber,
      branchName,
      status: doc.status,
      attempts: doc.attempts,
      createdAt: doc.createdAt.toISOString(),
      acceptedAt: doc.acceptedAt?.toISOString() ?? null,
      reason: reasonOf(doc),
    })),
  };
}

/** One document with its payload and what the SDC said about it; outside `scope` it reads as not found. */
export async function readFiscalDoc(
  db: ShopperDatabase,
  orgId: string,
  id: string,
  scope?: string[],
) {
  const [row] = await db
    .select({ doc: fiscalDoc, branchName: branch.name })
    .from(fiscalDoc)
    .innerJoin(branch, and(eq(branch.orgId, fiscalDoc.orgId), eq(branch.id, fiscalDoc.branchId)))
    .where(
      and(
        eq(fiscalDoc.orgId, orgId),
        eq(fiscalDoc.id, v.parse(fiscalDocId, id)),
        scope ? inArray(fiscalDoc.branchId, scope) : undefined,
      ),
    );
  if (!row) throw new FiscalError("NOT_FOUND", "Fiscal document not found");
  const { doc } = row;
  return {
    ...doc,
    branchName: row.branchName,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    signedAt: doc.signedAt?.toISOString() ?? null,
    acceptedAt: doc.acceptedAt?.toISOString() ?? null,
    reason: reasonOf(doc),
  };
}

/** One day's hourly bundles of every store, each with a short-lived download link when storage can sign one. */
export async function listFiscalArchives(
  db: ShopperDatabase,
  orgId: string,
  raw: unknown,
  blobs?: Blobs,
) {
  const { date } = v.parse(fiscalArchiveQuery, raw);
  const from = new Date(`${date}T00:00:00.000Z`);
  const rows = await db
    .select({ bundle: fiscalArchive, storeName: store.name })
    .from(fiscalArchive)
    .innerJoin(
      store,
      and(eq(store.orgId, fiscalArchive.orgId), eq(store.id, fiscalArchive.storeId)),
    )
    .where(
      and(
        eq(fiscalArchive.orgId, orgId),
        gte(fiscalArchive.hour, from),
        lt(fiscalArchive.hour, new Date(from.getTime() + 86_400_000)),
      ),
    )
    .orderBy(asc(fiscalArchive.hour), asc(store.name));
  return {
    archives: await Promise.all(
      rows.map(async ({ bundle, storeName }) => ({
        id: bundle.id,
        storeName,
        hour: bundle.hour.toISOString(),
        docCount: bundle.docCount,
        bytes: bundle.bytes,
        sha256: bundle.sha256,
        url: blobs ? await blobs.signedUrl(orgId, bundle.key, 300) : null,
      })),
    ),
  };
}

/** Why a document stopped: the SDC's rejection, or the last failure while it waits or after it was dead-lettered. */
function reasonOf(doc: typeof fiscalDoc.$inferSelect) {
  if (doc.status === "rejected") return `${doc.rejectionCode}: ${doc.rejectionMessage}`;
  return doc.status === "accepted" ? null : doc.lastError;
}

/**
 * The signatures of a store's accepted documents for these sales and credit notes, in the feed's shape. A till that
 * caught up through a snapshot skipped the feed rows that carried them, so it asks for those of its provisional
 * receipts.
 */
export async function fiscalSignatures(
  db: ShopperDatabase,
  scope: { orgId: string; storeId: string },
  ids: { saleIds: string[]; refundIds: string[] },
) {
  if (!ids.saleIds.length && !ids.refundIds.length) return [];
  const rows = await db
    .select()
    .from(fiscalDoc)
    .where(
      and(
        eq(fiscalDoc.orgId, scope.orgId),
        eq(fiscalDoc.storeId, scope.storeId),
        eq(fiscalDoc.status, "accepted"),
        or(
          ids.saleIds.length ? inArray(fiscalDoc.saleId, ids.saleIds) : undefined,
          ids.refundIds.length ? inArray(fiscalDoc.refundId, ids.refundIds) : undefined,
        ),
      ),
    );
  return rows.map(
    (doc) =>
      fiscalSigned({
        ...doc,
        sdcId: doc.sdcId!,
        sdcCounter: doc.sdcCounter!,
        signature: doc.signature!,
        qr: doc.qr!,
        signedAt: doc.signedAt!,
      }).payload,
  );
}
