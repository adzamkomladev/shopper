import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { canonicalJson } from "@shopper/audit";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import {
  hostSession,
  localSale,
  outbox,
  receiptOutput,
  saleDraft,
  saleDraftLine,
  saleDraftTender,
  saleLine,
  stockMovement,
  tillState,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import { sha256 } from "@shopper/utils";
import { tillSession } from "../schemas/till/session";
import { tillConfiguration } from "../schemas/till/config";
import { editDraftInput } from "../schemas/till/drafts";
import { buildReceipt } from "../receipts/build";
import { readLookupCustomer } from "./customers/queries";
import { buildSaleEvent, snapshotLines } from "./sale/snapshot";
import { assertDraftScope, claimDraft } from "./drafts/edit";
import { quoteDraft } from "./drafts/quote";
import { readQuoteReference } from "./quotation";
import { checkSession, hostTime } from "./session";
import { assignReceipt } from "./receipts/assign";
import { findRegisterSettings } from "./register/settings";
import { settle } from "./tenders/settle";
import { TillError } from "./error";
import { requireOpenShift } from "./shifts/queries";
import type { TillConfig } from "./types";

export async function completeDraftSale(
  db: TillDatabase,
  rawConfig: TillConfig,
  rawSession: unknown,
  raw: unknown,
) {
  const config = v.parse(tillConfiguration, rawConfig);
  const session = v.parse(tillSession, rawSession);
  const input = v.parse(editDraftInput, raw);
  const time = await hostTime(db, config, input.at);
  checkSession(session, config, "sale.create", time);
  const context = {
    orgId: config.orgId,
    deviceId: config.deviceId,
    branchId: config.branchId,
    actorId: session.userId,
    role: session.roleName,
    appVersion: config.appVersion,
    deviceTime: input.at,
  };
  assertDraftScope(context, input.scope);
  return complete(db, context, { ...input, at: time, deviceTime: input.at, config, session });
}

const complete = defineCommand({
  name: "sale.complete",
  run: finishDraftSale,
  audit: (_input, output) => ({ saleId: output.sale.id, lineCount: output.sale.lines.length }),
  details: (_input, output) => ({ entity: "sale", entityId: output.sale.id }),
});

export async function finishDraftSale(
  tx: TillSqlite,
  context: CommandContext,
  input: v.InferOutput<typeof editDraftInput> & {
    config: v.InferOutput<typeof tillConfiguration>;
    session: v.InferOutput<typeof tillSession>;
    deviceTime: Date;
  },
) {
  const { scope, config, session, at, deviceTime } = input;
  const open = await requireOpenShift(tx, scope);
  const found = await claimDraft(tx, scope, input.expectedRevision, at);
  if (!found.lines.length) throw new TillError("DRAFT_UNKNOWN", "Cannot complete an empty sale");
  const refs = await readQuoteReference(tx, scope.orgId);
  const quote = quoteDraft(refs, scope.branchId, at, found.lines, found.draft.totals);
  const lines = snapshotLines(quote.lines, found.lines);
  if (found.lines.some((l) => l.discount > 0)) checkSession(session, config, "sale.discount", at);
  const draftTenders = await tx
    .select()
    .from(saleDraftTender)
    .where(eq(saleDraftTender.draftId, found.draft.id))
    .orderBy(saleDraftTender.position);
  if (draftTenders.some((t) => t.kind === "momo" && ["pending", "otp"].includes(t.status)))
    throw new TillError("PAYMENT_UNCONFIRMED", "Resolve pending MoMo before completing the sale");
  const tenders = draftTenders.filter((t) =>
    t.kind === "momo" ? t.status === "confirmed" : t.status === "applied",
  );
  const settlement = settle(quote.totals.gross, tenders, refs.cashRounding);
  if (settlement.balance > 0 || !tenders.length)
    throw new TillError("TENDER_INSUFFICIENT", "Tender does not cover the balance");
  const receipt = await assignReceipt(tx, scope.orgId, scope.deviceId, config.receiptCodes);
  const id = v7();
  const customer = found.draft.customerId
    ? await readLookupCustomer(tx, scope.orgId, found.draft.customerId)
    : null;
  const event = buildSaleEvent({
    id,
    scope,
    config,
    sessionId: session.id,
    deviceTime,
    at,
    receipt,
    lines,
    totals: quote.totals,
    settlement,
    tenders,
    customer,
  });
  const [savedSession] = await tx.select().from(hostSession).where(eq(hostSession.id, session.id));
  if (savedSession && canonicalJson(savedSession) !== canonicalJson(session))
    throw new TillError("conflict", "Saved cashier session identity has different content");
  if (!savedSession) await tx.insert(hostSession).values(session);
  const [state] = await tx
    .select()
    .from(tillState)
    .where(and(eq(tillState.orgId, scope.orgId), eq(tillState.deviceId, scope.deviceId)));
  const localSeq = (state?.lastOutboxSeq ?? 0) + 1;
  if (!Number.isSafeInteger(localSeq))
    throw new TillError("counter", "Local ordering counter exhausted");
  await tx
    .insert(tillState)
    .values({
      id: state?.id ?? v7(),
      orgId: scope.orgId,
      deviceId: scope.deviceId,
      lastOutboxSeq: localSeq,
    })
    .onConflictDoUpdate({
      target: [tillState.orgId, tillState.deviceId],
      set: { lastOutboxSeq: localSeq },
    });
  // The register's own names go onto the receipt when it is built, so reprints and the PDF match the printout.
  const names = await findRegisterSettings(tx, scope);
  await tx.insert(localSale).values({
    id,
    orgId: scope.orgId,
    deviceId: scope.deviceId,
    localId: id,
    shiftId: open.id,
    payload: event.sale,
    contentHash: await sha256(canonicalJson(event.sale)),
    receipt: buildReceipt(event.sale, {
      ...config.receiptReference,
      ...(names && { branchName: names.value.storeName, deviceName: names.value.registerName }),
      tenderPhones: Object.fromEntries(tenders.flatMap((t) => (t.phone ? [[t.id, t.phone]] : []))),
    }),
  });
  await tx.insert(receiptOutput).values({ saleId: id, orgId: scope.orgId });
  for (const line of event.sale.lines)
    await tx
      .insert(saleLine)
      .values({ id: line.id, orgId: scope.orgId, saleId: id, payload: line });
  for (const line of event.sale.lines)
    await tx.insert(stockMovement).values({
      id: v7(),
      orgId: scope.orgId,
      deviceId: scope.deviceId,
      branchId: scope.branchId,
      productId: line.productId,
      saleId: id,
      saleLineId: line.id,
      quantityThousandths: -line.tax.quantityThousandths,
      reason: "sale",
      occurredAt: at.toISOString(),
    });
  await tx.insert(outbox).values({
    id: v7(),
    orgId: scope.orgId,
    deviceId: scope.deviceId,
    localId: id,
    localSeq,
    event,
  });
  await tx.delete(saleDraftTender).where(eq(saleDraftTender.draftId, found.draft.id));
  await tx.delete(saleDraftLine).where(eq(saleDraftLine.draftId, found.draft.id));
  await tx.delete(saleDraft).where(eq(saleDraft.id, found.draft.id));
  return event;
}
