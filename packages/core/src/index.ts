import { auditLog, type ShopperDatabase, type ShopperTransaction } from "@shopper/db-pg";

export interface CommandContext {
  orgId: string;
  actorId?: string;
  appVersion: string;
}
// This transaction boundary is also used by provisioning. Audit enrichment arrives on day 3.
export function defineCommand<Input, Output>(definition: {
  name: string;
  run: (tx: ShopperTransaction, context: CommandContext, input: Input) => Promise<Output>;
  audit: (input: Input, output: Output) => Record<string, unknown>;
}) {
  return (db: ShopperDatabase, context: CommandContext, input: Input): Promise<Output> =>
    db.transaction(async (tx) => {
      const output = await definition.run(tx, context, input);
      await tx.insert(auditLog).values({
        orgId: context.orgId,
        actorId: context.actorId,
        appVersion: context.appVersion,
        command: definition.name,
        payload: definition.audit(input, output),
      });
      return output;
    });
}
