import { and, eq, gte, lte } from "drizzle-orm";
import { branch, device, receiptBlock, type ShopperTransaction } from "@shopper/db-pg";
import type { SaleSnapshot } from "../schemas/till/sale";
import { SaleError } from "./error";

export async function validateReceipt(tx: ShopperTransaction, snapshot: SaleSnapshot) {
  if (snapshot.receiptNumber === null) return;
  const [registered] = await tx
    .select({ deviceCode: device.code, branchCode: branch.code })
    .from(device)
    .innerJoin(branch, and(eq(branch.orgId, device.orgId), eq(branch.id, device.branchId)))
    .where(and(eq(device.orgId, snapshot.orgId), eq(device.id, snapshot.deviceId)));
  const prefix = registered && `${registered.branchCode}-${registered.deviceCode}-`;
  if (!prefix || !snapshot.receiptNumber.startsWith(prefix))
    throw new SaleError("SCOPE", "Receipt belongs to another register");
  const suffix = snapshot.receiptNumber.slice(prefix.length);
  if (suffix.startsWith("X") !== snapshot.receiptOverflow)
    throw new SaleError("INVALID_EVENT", "Receipt overflow flag differs from number");
  const number = Number(suffix.replace(/^X/, ""));
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    suffix !== `${snapshot.receiptOverflow ? "X" : ""}${String(number).padStart(6, "0")}`
  )
    throw new SaleError("INVALID_EVENT", "Invalid receipt number");
  if (snapshot.receiptOverflow) return;
  const [block] = await tx
    .select({ id: receiptBlock.id })
    .from(receiptBlock)
    .where(
      and(
        eq(receiptBlock.orgId, snapshot.orgId),
        eq(receiptBlock.deviceId, snapshot.deviceId),
        lte(receiptBlock.start, number),
        gte(receiptBlock.end, number),
      ),
    );
  if (!block)
    throw new SaleError("INVALID_EVENT", "Receipt number was not issued to this register");
}
