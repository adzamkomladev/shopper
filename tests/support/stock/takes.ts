import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { category, product } from "@shopper/db-pg";
import { ids } from "../../fixtures/sales/golden";
import type { Portal } from "../api/portal";
import { databases } from "../till/server";
import { send } from "./http";

/** Opens a category take around one product, counts it, and returns the call that posts it. */
export async function startTake(owner: Portal, clerk: string, productId: string, counted: number) {
  const aisle = v7();
  const { db } = databases();
  await db.insert(category).values({ id: aisle, orgId: ids.org, name: `Alert aisle ${aisle}` });
  await db.update(product).set({ categoryId: aisle }).where(eq(product.id, productId));
  const take = v7();
  await send(owner.api, clerk, "POST", "/stock/takes", {
    id: take,
    branchId: ids.branch,
    scope: "category",
    categoryId: aisle,
  });
  await send(owner.api, clerk, "PUT", `/stock/takes/${take}/counts`, {
    lines: [{ productId, countedThousandths: counted }],
  });
  return () => send(owner.api, clerk, "POST", `/stock/takes/${take}/post`);
}
