import * as v from "valibot";
import { reference, type TillSqlite } from "@shopper/db-sqlite";
import { tillOrgSetting, type CashRounding, type TillOrgSetting } from "../schemas/till/reference";

export const ORG_SETTING_ENTITY = "org-setting";
export const DEFAULT_CASH_ROUNDING: CashRounding = "10p";

/** Replaces the org's settings row; a till provisioned by hand sends only the rounding, so the rest default. */
export async function storeOrgSettings(
  tx: TillSqlite,
  orgId: string,
  settings: Omit<v.InferInput<typeof tillOrgSetting>, "id">,
) {
  const payload = v.parse(tillOrgSetting, { ...settings, id: orgId });
  await tx
    .insert(reference)
    .values({ id: orgId, orgId, entity: ORG_SETTING_ENTITY, payload })
    .onConflictDoUpdate({
      target: [reference.orgId, reference.entity, reference.id],
      set: { payload },
    });
}

/** The org's settings from its reference rows; a till that never received them uses the defaults. */
export function readOrgSettings(
  rows: { entity: string; payload: unknown }[],
): Omit<TillOrgSetting, "id"> {
  const row = rows.find((candidate) => candidate.entity === ORG_SETTING_ENTITY);
  if (row) return v.parse(tillOrgSetting, row.payload);
  return {
    cashRounding: DEFAULT_CASH_ROUNDING,
    priceMode: "inclusive",
    vatRegisteredFrom: "2026-01-01",
    tin: null,
  };
}

export const readCashRounding = (rows: { entity: string; payload: unknown }[]) =>
  readOrgSettings(rows).cashRounding;
