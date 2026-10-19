import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { tillSetting, type TillDatabase, type TillSqlite } from "@shopper/db-sqlite";
import {
  registerSettings,
  saveRegisterInput,
  type RegisterSettings,
} from "../../schemas/till/register";
import { checkSession } from "../session";
import { TillError } from "../error";

type Scope = { orgId: string; deviceId: string; branchId: string };
type Names = { shopName: string; registerName: string };

/** The saved row, or `undefined` while the register still runs on its enrolled identity. */
export async function findRegisterSettings(tx: TillSqlite, scope: Scope) {
  const [row] = await tx
    .select()
    .from(tillSetting)
    .where(and(eq(tillSetting.orgId, scope.orgId), eq(tillSetting.deviceId, scope.deviceId)));
  // A payload that no longer parses must never stop a sale or the status: the enrolled names apply until it is saved again.
  const value = v.safeParse(registerSettings, row?.payload);
  return row && value.success ? { revision: row.revision, value: value.output } : undefined;
}

/** Saved settings, falling back to defaults built from the enrolled identity at revision 0. */
export async function readRegisterSettings(db: TillDatabase, identity: Scope & Names) {
  const saved = await db.read((tx) => findRegisterSettings(tx, identity));
  return saved ?? { revision: 0, value: defaultRegisterSettings(identity) };
}

export async function saveRegisterSettings(
  db: TillDatabase,
  context: CommandContext,
  scope: Scope & Names,
  raw: unknown,
) {
  const input = v.parse(saveRegisterInput, raw);
  checkSession(input.session, scope, "register.settings", input.at);
  return save(db, context, { ...input, scope });
}

const save = defineCommand({
  name: "till.settings.save",
  async run(
    tx,
    _context,
    input: v.InferOutput<typeof saveRegisterInput> & { scope: Scope & Names },
  ) {
    const { scope, settings, expectedRevision } = input;
    const saved = await findRegisterSettings(tx, scope);
    if ((saved?.revision ?? 0) !== expectedRevision)
      throw new TillError("REVISION_STALE", "Settings changed on this register. Reload and retry.");
    const revision = expectedRevision + 1;
    const values = { revision, payload: settings, updatedAt: input.at.toISOString() };
    await tx
      .insert(tillSetting)
      .values({ orgId: scope.orgId, deviceId: scope.deviceId, ...values })
      .onConflictDoUpdate({ target: [tillSetting.orgId, tillSetting.deviceId], set: values });
    return { revision, before: saved?.value ?? defaultRegisterSettings(scope), after: settings };
  },
  // The audit redactor hides any key containing "pin", so the returns flag is also recorded under a neutral name.
  audit: (_input, output) => ({
    revision: output.revision,
    returnsNeedManagerApproval: {
      before: output.before.requirePinForReturns,
      after: output.after.requirePinForReturns,
    },
    returnWindowDays: {
      before: output.before.returnWindowDays,
      after: output.after.returnWindowDays,
    },
  }),
  details: (input, output) => ({
    entity: "till_setting",
    entityId: input.scope.deviceId,
    before: output.before,
    after: output.after,
  }),
});

export function defaultRegisterSettings(names: Names): RegisterSettings {
  return {
    storeName: names.shopName,
    registerName: names.registerName,
    printAutomatically: true,
    paperMm: 80,
    clearCartAfterSale: true,
    requirePinForReturns: false,
    returnWindowDays: 30,
    printer: null,
    scanner: null,
    display: null,
  };
}
