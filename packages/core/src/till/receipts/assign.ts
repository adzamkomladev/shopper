import { and, eq } from "drizzle-orm";
import { tillState, type TillSqlite, type TillDatabase } from "@shopper/db-sqlite";
import { v7 } from "uuid";
import { TillError } from "../error";
import type { TillConfig } from "../types";

export async function assignReceipt(
  tx: TillSqlite,
  orgId: string,
  deviceId: string,
  codes?: TillConfig["receiptCodes"],
) {
  const [state] = await tx
    .select()
    .from(tillState)
    .where(and(eq(tillState.orgId, orgId), eq(tillState.deviceId, deviceId)));
  const branchCode = state?.branchCode ?? codes?.branchCode;
  const deviceCode = state?.deviceCode ?? codes?.deviceCode;
  if (!branchCode || !deviceCode)
    throw new TillError(
      "reference",
      "Save this register’s enrollment codes before recording sales",
    );
  if (codes && (codes.branchCode !== branchCode || codes.deviceCode !== deviceCode))
    throw new TillError("scope", "Enrollment codes differ from this register’s saved identity");
  if (!state)
    await tx.insert(tillState).values({ id: v7(), orgId, deviceId, branchCode, deviceCode });
  else if (!state.branchCode || !state.deviceCode)
    await tx
      .update(tillState)
      .set({ branchCode, deviceCode })
      .where(and(eq(tillState.orgId, orgId), eq(tillState.deviceId, deviceId)));
  const lastUsed = state?.receiptLastUsed ?? 0;
  const block = state?.receiptBlocks.find((block) => block.end > lastUsed);
  const overflow = !block;
  const number = block
    ? Math.max(block.start, lastUsed + 1)
    : (state?.receiptOverflowCounter ?? 0) + 1;
  if (!Number.isSafeInteger(number)) throw new Error("Receipt counter exhausted");
  await tx
    .update(tillState)
    .set(block ? { receiptLastUsed: number } : { receiptOverflowCounter: number })
    .where(and(eq(tillState.orgId, orgId), eq(tillState.deviceId, deviceId)));
  return {
    receiptNumber: `${branchCode}-${deviceCode}-${overflow ? "X" : ""}${String(number).padStart(6, "0")}`,
    receiptOverflow: overflow,
    clockOffsetMs: state?.clockOffsetMs ?? 0,
  };
}
export async function readReceiptStatus(database: TillDatabase, orgId: string, deviceId: string) {
  return database.read(async (tx) => {
    const [state] = await tx
      .select()
      .from(tillState)
      .where(and(eq(tillState.orgId, orgId), eq(tillState.deviceId, deviceId)));
    const receiptsLeft =
      state?.receiptBlocks.reduce(
        (count, block) =>
          count + Math.max(0, block.end - Math.max(block.start - 1, state.receiptLastUsed)),
        0,
      ) ?? 0;
    return {
      receiptsLeft,
      overflow: receiptsLeft === 0 && (state?.receiptOverflowCounter ?? 0) > 0,
    };
  });
}
