// The e2e shop's online catalogue, written straight to the e2e database with the integration helper.
//   e2eStore(tag)  -> { branches: [osu, kaneshie], category, products: { rice, oil, hidden } }; names end in the tag
//   rice is in stock at Osu only; oil at both, cheaper at Kaneshie; hidden is never online.
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { E2E_DATABASE_URL } from "../../../tooling/database/e2e";
import { SHOP } from "./browser";
import { stockShop } from "./store";

export async function e2eStore(tag: string) {
  const pool = new Pool({ connectionString: E2E_DATABASE_URL });
  const db = drizzle(pool, { schema });
  const [org] = await db
    .select({ id: schema.org.id })
    .from(schema.org)
    .where(eq(schema.org.slug, SHOP));
  const shop = await stockShop(db, { orgId: org!.id, slug: SHOP }, `Pantry ${tag}`);
  // Earlier runs left branches with the same names; these carry the tag.
  for (const [index, id] of shop.branches.entries())
    await db
      .update(schema.branch)
      .set({ name: `${index === 0 ? "Osu" : "Kaneshie"} ${tag}` })
      .where(eq(schema.branch.id, id));
  const products = {
    rice: await shop.product(`Jasmine rice ${tag}`, { stock: [10_000, 0] }),
    oil: await shop.product(`Frytol oil ${tag}`, { price: 300_000, otherPrice: 280_000 }),
    hidden: await shop.product(`Staff biscuits ${tag}`, { visible: false }),
  };
  await pool.end();
  return {
    branches: shop.branches,
    category: { id: shop.category, name: `Pantry ${tag}` },
    products,
  };
}
