import { and, eq } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit";
import { stockTake, type ShopperTransaction } from "@shopper/db-pg";
import { StockError } from "../error";

/** The take, locked for this command. A till only reaches its own branch's takes; a closed take is TAKE_CLOSED. */
export async function lockOpenTake(tx: ShopperTransaction, ctx: CommandContext, id: string) {
  const [take] = await tx
    .select()
    .from(stockTake)
    .where(and(eq(stockTake.orgId, ctx.orgId), eq(stockTake.id, id)))
    .for("update");
  if (!take || (ctx.deviceId && take.branchId !== ctx.branchId))
    throw new StockError("NOT_FOUND", "Stock take not found");
  if (take.status !== "open") throw new StockError("TAKE_CLOSED", `Stock take is ${take.status}`);
  return take;
}
