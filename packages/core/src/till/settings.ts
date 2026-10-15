import * as v from "valibot";
import { reference, type TillSqlite } from "@shopper/db-sqlite";
import { tillOrgSetting, type CashRounding } from "../schemas/till/reference";

export const ORG_SETTING_ENTITY = "org-setting";
export const DEFAULT_CASH_ROUNDING: CashRounding = "10p";

export async function storeCashRounding(tx: TillSqlite, orgId: string, cashRounding: CashRounding) {
  const payload = { id: orgId, cashRounding };
  await tx
    .insert(reference)
    .values({ id: orgId, orgId, entity: ORG_SETTING_ENTITY, payload })
    .onConflictDoUpdate({
      target: [reference.orgId, reference.entity, reference.id],
      set: { payload },
    });
}

export function readCashRounding(rows: { entity: string; payload: unknown }[]): CashRounding {
  const row = rows.find((candidate) => candidate.entity === ORG_SETTING_ENTITY);
  return row ? v.parse(tillOrgSetting, row.payload).cashRounding : DEFAULT_CASH_ROUNDING;
}
