import { eq } from "drizzle-orm";
import { org } from "@shopper/db-pg";
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
