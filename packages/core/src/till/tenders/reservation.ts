import { eq } from "drizzle-orm";
import { saleDraftTender, type TillSqlite } from "@shopper/db-sqlite";
import type { Money } from "@shopper/money";
import { settle } from "./settle";

export async function assertTenderBalance(
  tx: TillSqlite,
  draftId: string,
  gross: Money,
  rounding: "none" | "10p",
) {
  const tenders = await tx
    .select()
    .from(saleDraftTender)
    .where(eq(saleDraftTender.draftId, draftId));
  settle(
    gross,
    tenders.filter((t) => t.kind !== "momo" || ["pending", "otp", "confirmed"].includes(t.status)),
    rounding,
  );
}
