import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { tillState } from "@shopper/db-sqlite";
import { defineCommand } from "@shopper/audit/sqlite";
import type { PushOptions } from "./push/types";

const number = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
export const receiptsSchema = v.strictObject({
  branchCode: v.pipe(v.string(), v.regex(/^BR[0-9]+$/)),
  deviceCode: v.pipe(v.string(), v.regex(/^T[0-9]+$/)),
  blocks: v.pipe(v.array(v.strictObject({ start: number, end: number })), v.maxLength(2)),
});
export function createReceiptStorage(options: PushOptions) {
  const { database, config } = options;
  const scope = and(eq(tillState.orgId, config.orgId), eq(tillState.deviceId, config.deviceId));
  const save = defineCommand(
    {
      name: "till.receipts.sync",
      async run(
        tx,
        _ctx,
        input: { receipts: v.InferOutput<typeof receiptsSchema>; clockOffsetMs?: number },
      ) {
        const values = {
          branchCode: input.receipts.branchCode,
          deviceCode: input.receipts.deviceCode,
          receiptBlocks: input.receipts.blocks,
          ...(input.clockOffsetMs === undefined ? {} : { clockOffsetMs: input.clockOffsetMs }),
        };
        await tx
          .insert(tillState)
          .values({ id: v7(), orgId: config.orgId, deviceId: config.deviceId, ...values })
          .onConflictDoUpdate({ target: [tillState.orgId, tillState.deviceId], set: values });
      },
      audit: (input) => input,
    },
    options.now,
  );
  return {
    lastUsed: () =>
      database.read(
        async (tx) => (await tx.select().from(tillState).where(scope))[0]?.receiptLastUsed ?? 0,
      ),
    async save(raw: unknown, serverTime?: string, deviceTime?: number) {
      const receipts = v.parse(receiptsSchema, raw);
      if (
        receipts.blocks.some(
          (block, index) =>
            block.end < block.start ||
            (index > 0 && block.start <= receipts.blocks[index - 1]!.end),
        )
      )
        throw new Error("Invalid receipt blocks");
      const clockOffsetMs =
        serverTime === undefined
          ? undefined
          : (deviceTime ?? (options.now ?? Date.now)()) -
            Date.parse(v.parse(v.pipe(v.string(), v.isoTimestamp()), serverTime));
      await save(
        database,
        { orgId: config.orgId, deviceId: config.deviceId, appVersion: config.appVersion },
        { receipts, ...(clockOffsetMs === undefined ? {} : { clockOffsetMs }) },
      );
    },
  };
}
