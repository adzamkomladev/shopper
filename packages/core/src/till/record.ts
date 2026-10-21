import * as v from "valibot";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { saleDraft, saleDraftLine, saleDraftTender, type TillDatabase } from "@shopper/db-sqlite";
import { recordSaleInput } from "../schemas/till/sale";
import { tillSession } from "../schemas/till/session";
import { tillConfiguration } from "../schemas/till/config";
import { checkSession, hostTime } from "./session";
import { TillError } from "./error";
import { quoteDraft } from "./drafts/quote";
import { findDraft } from "./drafts/queries";
import { readQuoteReference } from "./quotation";
import { settle } from "./tenders/settle";
import { finishDraftSale } from "./complete";
import { requireOpenShift } from "./shifts/queries";
import type { TillConfig } from "./types";

/** Compatibility for direct-line callers; all persistence uses the draft completion transaction. */
export async function recordLocalSale(
  db: TillDatabase,
  rawConfig: TillConfig,
  rawSession: unknown,
  raw: unknown,
) {
  const config = v.parse(tillConfiguration, rawConfig);
  const session = v.parse(tillSession, rawSession);
  const data = v.parse(recordSaleInput, raw);
  const deviceTime = rawConfig.now?.() ?? new Date();
  const at = await hostTime(db, config, deviceTime);
  checkSession(session, config, "sale.create", at);
  const context = {
    orgId: config.orgId,
    deviceId: config.deviceId,
    branchId: config.branchId,
    actorId: session.userId,
    role: session.roleName,
    appVersion: config.appVersion,
    deviceTime,
  };
  return record(db, context, { config, session, data, at, deviceTime });
}

const record = defineCommand({
  name: "sale.complete",
  async run(
    tx,
    context,
    input: {
      config: v.InferOutput<typeof tillConfiguration>;
      session: v.InferOutput<typeof tillSession>;
      data: v.InferOutput<typeof recordSaleInput>;
      at: Date;
      deviceTime: Date;
    },
  ) {
    const { config, session, at } = input;
    const scope = {
      orgId: config.orgId,
      deviceId: config.deviceId,
      branchId: config.branchId,
      cashierId: session.userId,
    };
    // Before the basket check, so a closed register says so rather than "complete the open basket".
    await requireOpenShift(tx, scope);
    if (await findDraft(tx, scope))
      throw new TillError("conflict", "Complete the open basket before recording direct lines");
    const id = v7();
    const stamp = at.toISOString();
    await tx
      .insert(saleDraft)
      .values({ id, ...scope, revision: 1, totals: {}, createdAt: stamp, updatedAt: stamp });
    for (const [position, line] of input.data.lines.entries()) {
      await tx
        .insert(saleDraftLine)
        .values({ ...line, id: v7(), orgId: scope.orgId, draftId: id, position });
    }
    const lines = await tx.select().from(saleDraftLine).where(eq(saleDraftLine.draftId, id));
    const refs = await readQuoteReference(tx, scope.orgId);
    const quote = quoteDraft(refs, scope.branchId, at, lines, {});
    const invalid = quote.lines.find((line) => line.error);
    if (invalid?.error) {
      const coarse = ["PRODUCT_UNKNOWN", "PRICE_MISSING", "TAX_RULE_MISSING"].includes(
        invalid.error,
      );
      throw new TillError(coarse ? "reference" : invalid.error, "Cannot quote direct sale line");
    }
    await tx.insert(saleDraftTender).values({
      id: v7(),
      orgId: scope.orgId,
      draftId: id,
      position: 0,
      kind: "cash",
      amount: settle(quote.totals.gross, [], refs.cashRounding, "cash").total,
      status: "applied",
      createdAt: stamp,
    });
    return finishDraftSale(tx, context, { ...input, scope, expectedRevision: 1 });
  },
  audit: (_input, output) => ({ saleId: output.sale.id, lineCount: output.sale.lines.length }),
  details: (_input, output) => ({ entity: "sale", entityId: output.sale.id }),
});
