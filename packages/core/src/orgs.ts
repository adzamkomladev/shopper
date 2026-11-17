import { and, eq, inArray } from "drizzle-orm";
import { boxMove, org } from "@shopper/db-pg";
import type { Queryable } from "./types";

const summary = { id: org.id, name: org.name };

/** The shop code is case-insensitive and may carry stray spaces. */
export async function findOrgBySlug(db: Queryable, slug: string) {
  const [row] = await db.select(summary).from(org).where(eq(org.slug, slug.trim().toLowerCase()));
  return row ?? null;
}

export async function findOrg(db: Queryable, id: string) {
  const [row] = await db.select(summary).from(org).where(eq(org.id, id));
  return row ?? null;
}

/** A move onto the shop's own box that keeps the cloud from writing: under way, or done for good. */
export const MOVING = ["open", "claimed", "archived"] as const;

/** Where the shop's move onto its own box stands, while it keeps the cloud's own workflows away; else undefined. */
export async function movingOnPrem(db: Queryable, orgId: string) {
  const [row] = await db
    .select({ status: boxMove.status })
    .from(boxMove)
    .where(and(eq(boxMove.orgId, orgId), inArray(boxMove.status, [...MOVING])));
  return row?.status;
}
