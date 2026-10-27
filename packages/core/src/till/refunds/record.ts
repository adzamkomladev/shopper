import * as v from "valibot";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import {
  hostSession,
  reference,
  refund,
  stockMovement,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import { buildRefundReceipt } from "../../receipts/build";
import { tillConfiguration } from "../../schemas/till/config";
import { eligibilityInput, planRefundInput, recordRefundInput } from "../../schemas/till/refunds";
import { tillSession, type TillSession } from "../../schemas/till/session";
import { authorize } from "../approvals";
import { TillError } from "../error";
import { findRegisterSettings } from "../register/settings";
import { readOrgSettings } from "../settings";
import { assignReceipt } from "../receipts/assign";
import { checkSession, hostTime } from "../session";
import { requireOpenShift } from "../shifts/queries";
import { buildRefund, eligibility } from "./eligibility";
import type { Original } from "./types";
import { loadLocalOriginal, readEligibility, refundPolicy } from "./queries";

type Config = v.InferOutput<typeof tillConfiguration>;
type Input = v.InferOutput<typeof recordRefundInput>;
type Prepared = { config: Config; session: TillSession; data: Input; time: Date };

/** Records a refund on this till: the refund, its return stock movements and receipt, in one audited transaction. */
export async function recordRefund(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const prepared = await prepare(db, rawConfig, rawSession, recordRefundInput, raw);
  const context = {
    orgId: prepared.config.orgId,
    deviceId: prepared.config.deviceId,
    branchId: prepared.config.branchId,
    actorId: prepared.session.userId,
    role: prepared.session.roleName,
    appVersion: prepared.config.appVersion,
    deviceTime: prepared.data.at,
    reason: prepared.data.reason,
  };
  return record(db, context, prepared);
}

/** Checks everything `recordRefund` would and builds the event without writing, so the server can be asked first. */
export async function planRefund(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const prepared = await prepare(db, rawConfig, rawSession, planRefundInput, raw);
  return db.read((tx) => plan(tx, prepared));
}

/** The eligibility view of a sale made here (or of `original`, a sale of another register). */
export async function readRefundEligibility(db: TillDatabase, rawConfig: unknown, raw: unknown) {
  const config = v.parse(tillConfiguration, rawConfig);
  const data = v.parse(eligibilityInput, raw);
  const time = await hostTime(db, config, data.at);
  return db.read(async (tx) => {
    const original = data.original
      ? fromServer(data.original)
      : await loadLocalOriginal(tx, config, data.saleId);
    if (!original) throw new TillError("SALE_UNKNOWN", "This sale is unavailable on this register");
    return readEligibility(tx, config, original, time);
  });
}

async function prepare<S extends v.GenericSchema>(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  schema: S,
  raw: unknown,
) {
  const config = v.parse(tillConfiguration, rawConfig);
  const session = v.parse(tillSession, rawSession);
  const data = v.parse(schema, raw) as Input;
  return { config, session, data, time: await hostTime(db, config, data.at) } satisfies Prepared;
}

/**
 * Takes the next number of the register's block for a credit note that goes to the server before it is recorded, so
 * the event the server accepts and the one recorded here carry the same number.
 */
export async function reserveCreditNote(db: TillDatabase, rawConfig: unknown, rawSession: unknown) {
  const config = v.parse(tillConfiguration, rawConfig);
  const session = v.parse(tillSession, rawSession);
  return reserve(
    db,
    {
      orgId: config.orgId,
      deviceId: config.deviceId,
      branchId: config.branchId,
      actorId: session.userId,
      role: session.roleName,
      appVersion: config.appVersion,
    },
    config,
  );
}

const reserve = defineCommand({
  name: "refund.credit_note.reserve",
  run: async (tx, context, config: Config) =>
    (await assignReceipt(tx, context.orgId, config.deviceId, config.receiptCodes)).receiptNumber,
  audit: (_input, creditNoteNumber) => ({ creditNoteNumber }),
});

const record = defineCommand({
  name: "refund.record",
  async run(tx, context, unnumbered: Prepared) {
    // An offline refund takes its credit-note number now, in the transaction that records it.
    const creditNoteNumber =
      unnumbered.data.creditNoteNumber ??
      (
        await assignReceipt(
          tx,
          context.orgId,
          unnumbered.config.deviceId,
          unnumbered.config.receiptCodes,
        )
      ).receiptNumber;
    const prepared = { ...unnumbered, data: { ...unnumbered.data, creditNoteNumber } };
    const { event, receipt, original, approverId, shiftId } = await plan(tx, prepared);
    context.approverId = approverId ?? undefined;
    const { config, session, data, time } = prepared;
    const { refund: snapshot } = event;
    await tx.insert(hostSession).values(session).onConflictDoNothing();
    await tx.insert(refund).values({
      id: snapshot.id,
      orgId: config.orgId,
      deviceId: config.deviceId,
      originalSaleId: snapshot.originalSaleId,
      origin: original.origin,
      original: data.original ?? null,
      payload: event,
      receipt,
      sessionId: session.id,
      shiftId,
      createdAt: time.toISOString(),
      acceptedAt: data.acceptedAt?.toISOString() ?? null,
    });
    for (const line of snapshot.lines) {
      const local = original.origin === "local";
      await tx.insert(stockMovement).values({
        id: v7(),
        orgId: config.orgId,
        deviceId: config.deviceId,
        branchId: config.branchId,
        productId: line.productId,
        saleId: local ? snapshot.originalSaleId : null,
        saleLineId: local ? line.originalLineId : null,
        refundId: snapshot.id,
        refundLineId: line.id,
        quantityThousandths: line.tax.quantityThousandths,
        reason: "return",
        occurredAt: time.toISOString(),
      });
    }
    return { event, receipt, origin: original.origin };
  },
  audit: (_input, output) => ({
    refundId: output.event.refund.id,
    originalSaleId: output.event.refund.originalSaleId,
    origin: output.origin,
    tender: output.event.refund.tender.kind,
    total: output.event.refund.total,
    lines: output.event.refund.lines.map((line) => ({
      originalLineId: line.originalLineId,
      quantityThousandths: line.tax.quantityThousandths,
    })),
  }),
  details: (_input, output) => ({ entity: "refund", entityId: output.event.refund.id }),
});

/** Session, policy, quantities and pricing in one read, so planning and recording cannot disagree. */
async function plan(tx: TillSqlite, { config, session, data, time }: Prepared) {
  checkSession(session, config, "refund.request", time);
  const { id: shiftId } = await requireOpenShift(tx, config);
  const original = data.original
    ? fromServer(data.original)
    : await loadLocalOriginal(tx, config, data.saleId);
  if (!original) throw new TillError("SALE_UNKNOWN", "This sale is unavailable on this register");
  const policy = await refundPolicy(tx, config);
  const view = eligibility(original, policy, time);
  const approverId =
    authorize(session, config, "refund.request", time, data.approverId, view.approvalRequired) ??
    null;
  const names = await findRegisterSettings(tx, config);
  const settings = readOrgSettings(await tx.select().from(reference));
  const event = {
    v: 4 as const,
    type: "refund.recorded" as const,
    refund: buildRefund(
      original,
      {
        lines: data.lines,
        tender: data.tender,
        reason: data.reason,
        approverId,
        approvalId: data.approvalId,
      },
      {
        orgId: config.orgId,
        deviceId: config.deviceId,
        storeId: config.storeId,
        branchId: config.branchId,
        cashierId: session.userId,
        sessionId: session.id,
        appVersion: config.appVersion,
        deviceTime: data.at.toISOString(),
        clockOffsetMs: data.at.valueOf() - time.valueOf(),
      },
      settings.cashRounding,
      { id: data.id, lineIds: data.lineIds, creditNoteNumber: data.creditNoteNumber },
    ),
  };
  const receipt = buildRefundReceipt(
    event.refund,
    { receiptNumber: original.sale.receiptNumber, customer: original.sale.customer },
    {
      ...config.receiptReference,
      tin: settings.tin ?? config.receiptReference?.tin,
      ...(names && { branchName: names.value.storeName, deviceName: names.value.registerName }),
    },
  );
  return { event, receipt, original, approverId, shiftId };
}

const fromServer = (found: NonNullable<Input["original"]>): Original => ({
  origin: "server",
  sale: found.sale,
  occurredAt: found.occurredAt,
  receipt: found.receipt,
  refunded: found.refunded,
  cashRefunded: found.cashRefunded,
  accountCredited: found.accountCredited,
  pointsReturned: found.pointsReturned,
  finalSale: found.finalSale,
});
