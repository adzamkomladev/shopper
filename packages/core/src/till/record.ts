import { sha256 } from "@shopper/utils";
import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { canonicalJson } from "@shopper/audit";
import { defineCommand } from "@shopper/audit/sqlite";
import {
  hostSession,
  localSale,
  outbox,
  saleLine,
  tillState,
  type TillDatabase,
} from "@shopper/db-sqlite";
import { add } from "@shopper/money";
import { recordSaleInput, saleEvent, saleTotals } from "../schemas/till/sale";
import { tillSession, type TillSession } from "../schemas/till/session";
import { checkSession, hostTime } from "./session";
import { TillError } from "./error";
import { quoteFrom, readQuoteReference } from "./quotation";
import { tillConfiguration } from "../schemas/till/config";
import { assignReceipt } from "./receipts/assign";
import type { TillConfig } from "./types";

export async function recordLocalSale(
  db: TillDatabase,
  config: TillConfig,
  rawSession: unknown,
  input: unknown,
) {
  config = { ...v.parse(tillConfiguration, config), now: config.now };
  const session = v.parse(tillSession, rawSession);
  const data = v.parse(recordSaleInput, input);
  const deviceTime = config.now?.() ?? new Date();
  const time = await hostTime(db, config, deviceTime);
  checkSession(session, config, "sale.create", time);
  return record(
    db,
    {
      orgId: config.orgId,
      deviceId: config.deviceId,
      branchId: config.branchId,
      actorId: session.userId,
      role: session.roleName,
      appVersion: config.appVersion,
      deviceTime,
    },
    { config, session, data, time, deviceTime },
  );
}

const coarse = new Set<string>(["PRODUCT_UNKNOWN", "PRICE_MISSING", "TAX_RULE_MISSING"]);

const record = defineCommand({
  name: "sale.record-local",
  async run(
    tx,
    context,
    input: {
      config: TillConfig;
      session: TillSession;
      data: v.InferOutput<typeof recordSaleInput>;
      time: Date;
      deviceTime: Date;
    },
  ) {
    const { config, session, data, time, deviceTime } = input;
    const receipt = await assignReceipt(tx, context.orgId, config.deviceId, config.receiptCodes);
    const refs = await readQuoteReference(tx, context.orgId);
    const lines = data.lines.map((line) => {
      try {
        return {
          id: v7(),
          ...quoteFrom(refs, { branchId: config.branchId, at: time, ...line }),
        };
      } catch (error) {
        // Recording keeps its coarse "reference" code; quoting reports the precise one.
        if (error instanceof TillError && coarse.has(error.code))
          throw new TillError("reference", error.message);
        throw error;
      }
    });
    const totals = v.parse(saleTotals, {
      base: 0,
      vat: 0,
      nhil: 0,
      getfund: 0,
      covid: 0,
      gross: 0,
      roundingAdjustment: 0,
    });
    for (const line of lines) {
      for (const key of Object.keys(totals) as (keyof typeof totals)[])
        totals[key] = add(totals[key], line.tax[key]);
    }
    const id = v7();
    const event = v.parse(saleEvent, {
      v: 2,
      type: "sale.recorded",
      sale: {
        id,
        localId: id,
        orgId: context.orgId,
        deviceId: context.deviceId,
        storeId: config.storeId,
        branchId: context.branchId,
        cashierId: context.actorId,
        sessionId: session.id,
        appVersion: config.appVersion,
        deviceTime: deviceTime.toISOString(),
        ...receipt,
        clockOffsetMs: deviceTime.valueOf() - time.valueOf(),
        lines,
        totals,
      },
    });
    const [savedSession] = await tx
      .select()
      .from(hostSession)
      .where(eq(hostSession.id, session.id));
    if (savedSession && canonicalJson(savedSession) !== canonicalJson(session))
      throw new TillError("conflict", "Saved cashier session identity has different content");
    if (!savedSession) await tx.insert(hostSession).values(session);
    const [state] = await tx
      .select()
      .from(tillState)
      .where(and(eq(tillState.orgId, context.orgId), eq(tillState.deviceId, config.deviceId)));
    const localSeq = (state?.lastOutboxSeq ?? 0) + 1;
    if (!Number.isSafeInteger(localSeq))
      throw new TillError("counter", "Local ordering counter exhausted");
    await tx
      .insert(tillState)
      .values({
        id: state?.id ?? v7(),
        orgId: context.orgId,
        deviceId: config.deviceId,
        lastOutboxSeq: localSeq,
      })
      .onConflictDoUpdate({
        target: [tillState.orgId, tillState.deviceId],
        set: { lastOutboxSeq: localSeq },
      });
    const contentHash = await sha256(canonicalJson(event.sale));
    await tx.insert(localSale).values({
      id,
      orgId: context.orgId,
      deviceId: config.deviceId,
      localId: id,
      payload: event.sale,
      contentHash,
    });
    for (const line of event.sale.lines)
      await tx
        .insert(saleLine)
        .values({ id: line.id, orgId: context.orgId, saleId: id, payload: line });
    await tx.insert(outbox).values({
      id: v7(),
      orgId: context.orgId,
      deviceId: config.deviceId,
      localId: id,
      localSeq,
      event,
    });
    return event;
  },
  audit: (_input, output) => ({ saleId: output.sale.id, lineCount: output.sale.lines.length }),
  details: (_input, output) => ({ entity: "sale", entityId: output.sale.id }),
});
