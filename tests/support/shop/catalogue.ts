// The e2e shop's online catalogue, written straight to the e2e database with the integration helper.
//   e2eStore(tag)  -> { branches: [osu, kaneshie], category, products: { rice, oil, hidden, milo } }; names end in the tag
//   rice is in stock at Osu only; oil at both, cheaper at Kaneshie; hidden is never online; milo is one tin at Osu.
//   `checkout` opens Osu for online pickup orders round the clock.
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { E2E_DATABASE_URL } from "../../../tooling/database/e2e";
import { SHOP } from "./browser";
import { stockShop } from "./store";

export async function e2eStore(tag: string, options: { checkout?: boolean } = {}) {
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
    // The last tin at Osu: two shoppers race for it in the checkout suite.
    milo: await shop.product(`Milo tin ${tag}`, { stock: [1_000, 0] }),
  };
  // The checkout suite has Osu take online orders round the clock, pickup only.
  if (options.checkout)
    await db.insert(schema.branchFulfilment).values({
      orgId: org!.id,
      branchId: shop.branches[0],
      opens: "00:00",
      closes: "23:00",
      slotCapacity: 500,
      leadMinutes: 0,
    });
  await pool.end();
  return {
    branches: shop.branches,
    category: { id: shop.category, name: `Pantry ${tag}` },
    products,
  };
}
