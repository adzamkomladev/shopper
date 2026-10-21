import type { ManagementKind } from "./types";
export type { ManagementKind } from "./types";
import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { store, branch, type ShopperDatabase } from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { money } from "@shopper/money";

import {
  branchInput,
  branchPatch,
  managementId,
  storeInput,
  storePatch,
} from "./schemas/management";

export {
  managementId,
  branchInput,
  branchPatch,
  storeInput,
  storePatch,
} from "./schemas/management";

export class ManagementError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 = 404,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
// bigint cursors are strings in both API responses and immutable audit snapshots.
export function managementJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  );
}
export async function readManagement(
  db: ShopperDatabase,
  orgId: string,
  kind: ManagementKind,
  id?: string,
) {
  const table = kind === "store" ? store : branch;
  return db
    .select()
    .from(table)
    .where(and(eq(table.orgId, orgId), id ? eq(table.id, v.parse(managementId, id)) : undefined));
}
export const mutateManagement = defineCommand({
  name: "management.mutate",
  async run(
    tx,
    context,
    input: {
      kind: ManagementKind;
      action: "create" | "update" | "delete";
      id?: string;
      data?: unknown;
    },
  ) {
    const { kind, action } = input;
    const table = kind === "store" ? store : branch;
    const id = action === "create" ? undefined : v.parse(managementId, input.id);
    const where = and(eq(table.orgId, context.orgId), id ? eq(table.id, id) : undefined);
    const [before] =
      action === "create" ? [] : await tx.select().from(table).where(where).for("update");
    if (action !== "create" && !before) throw new ManagementError("Record not found");
    let after;
    if (action === "delete") {
      await tx.delete(table).where(where);
    } else if (kind === "store") {
      const data = v.parse(action === "create" ? storeInput : storePatch, input.data);
      if (action === "update" && !Object.keys(data).length)
        throw new ManagementError("Provide at least one field", 400);
      const values = {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.cashRoundingStep !== undefined
          ? { cashRoundingStep: money(data.cashRoundingStep) }
          : {}),
      };
      [after] =
        action === "create"
          ? await tx
              .insert(store)
              .values({ orgId: context.orgId, name: data.name!, ...values })
              .returning()
          : await tx.update(store).set(values).where(where).returning();
    } else {
      const data = v.parse(action === "create" ? branchInput : branchPatch, input.data);
      if (action === "update" && !Object.keys(data).length)
        throw new ManagementError("Provide at least one field", 400);
      if (data.storeId) {
        const [parent] = await tx
          .select({ id: store.id })
          .from(store)
          .where(and(eq(store.orgId, context.orgId), eq(store.id, data.storeId)));
        if (!parent) throw new ManagementError("Store not found");
      }
      [after] =
        action === "create"
          ? await tx
              .insert(branch)
              .values({
                orgId: context.orgId,
                name: data.name!,
                storeId: data.storeId!,
                alertPhones: data.alertPhones,
              })
              .returning()
          : await tx.update(branch).set(data).where(where).returning();
    }
    return managementJson({
      id: after?.id ?? before!.id,
      before: before ?? null,
      after: after ?? null,
    });
  },
  audit: (input, result) => ({ action: input.action, entity: input.kind, entityId: result.id }),
  details: (input, result) => ({
    entity: input.kind,
    entityId: result.id,
    before: result.before,
    after: result.after,
  }),
});
