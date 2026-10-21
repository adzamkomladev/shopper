import * as v from "valibot";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { GENESIS_HASH } from "@shopper/audit";
import { defineCommand } from "@shopper/audit/sqlite";
import { money, sub } from "@shopper/money";
import {
  hostSession,
  saleDraft,
  saleDraftTender,
  shift,
  tillAudit,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import { DEFAULT_VARIANCE_THRESHOLD } from "../../schemas/till/register";
import {
  storedDeclaration,
  zReport,
  type XReport,
  type declaration,
} from "../../schemas/till/shift";
import { closeShiftInput, countedCash, declareShiftInput } from "../../schemas/till/shifts";
import { authorize } from "../approvals";
import { TillError } from "../error";
import { findRegisterSettings } from "../register/settings";
import { contextOf, prepare } from "./commands";
import { findShift, readShiftParts, requireOpenShift } from "./queries";
import { buildShiftReport } from "./report";
import type { Prepared } from "./types";

type Declared = v.InferOutput<typeof declaration>;

/**
 * The blind count: the drawer by denomination and the card and MoMo terminal totals. It is final, and selling
 * stops until the shift closes. Answers the variance per tender and whether a manager must approve the close.
 */
export async function declareShift(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const { at, counts, card, momo } = v.parse(declareShiftInput, raw);
  const prepared = await prepare(db, rawConfig, rawSession, at, "shift.write");
  const declared = { counts, cash: countedCash(counts), card, momo };
  return declare(db, contextOf(prepared), { ...prepared, declared });
}

/** Closes a counted shift into its Z, anchored on the till audit chain head. `approverId` is PIN-verified. */
export async function closeShift(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const input = v.parse(closeShiftInput, raw);
  const prepared = await prepare(db, rawConfig, rawSession, input.at, "shift.write");
  return close(db, contextOf(prepared), { ...prepared, approverId: input.approverId });
}

const declare = defineCommand({
  name: "shift.declare",
  async run(tx, _context, input: Prepared & { declared: Declared }) {
    const found = await requireOpenShift(tx, input.config);
    if (await hasTenderedBasket(tx, input.config))
      throw new TillError("SHIFT_BUSY", "Finish or void the basket with a payment first");
    // The threshold is fixed at the count, so the close judges the variance as the cashier was told.
    const limit = await threshold(tx, input.config);
    await tx
      .update(shift)
      .set({ status: "declared", declaration: { ...input.declared, threshold: limit } })
      .where(eq(shift.id, found.id));
    const report = buildShiftReport(await readShiftParts(tx, found), input.time);
    return { shiftId: found.id, ...judge(report, input.declared, limit) };
  },
  audit: (input, output) => ({
    shiftId: output.shiftId,
    declared: input.declared,
    variances: output.variances,
    approvalRequired: output.approvalRequired,
  }),
  details: (_input, output) => ({ entity: "shift", entityId: output.shiftId }),
});

const close = defineCommand({
  name: "shift.close",
  async run(tx, context, input: Prepared & { approverId: string | undefined }) {
    const { config, session, time } = input;
    const found = await findShift(tx, config);
    if (!found) throw new TillError("SHIFT_REQUIRED", "Register closed. Open a shift");
    if (found.status === "open") throw new TillError("SHIFT_OPEN", "Count the drawer first");
    const { threshold: limit, ...declared } = v.parse(storedDeclaration, found.declaration);
    const x = buildShiftReport(await readShiftParts(tx, found), time);
    const judged = judge(x, declared, limit);
    const approverId =
      authorize(session, config, "shift.write", time, input.approverId, judged.approvalRequired) ??
      null;
    context.approverId = approverId ?? undefined;
    // The upload proves the close with this session, so the till keeps it like a sale's.
    await tx.insert(hostSession).values(session).onConflictDoNothing();
    const anchor = await chainHead(tx, config.orgId);
    const closedAt = time.toISOString();
    const report = v.parse(zReport, {
      ...x,
      kind: "z",
      appVersion: config.appVersion,
      declared,
      variances: judged.variances,
      threshold: limit,
      approverId,
      closedAt,
      closedBy: session.userId,
      anchor,
    });
    await tx
      .update(shift)
      .set({
        status: "closed",
        closedAt,
        closedBy: session.userId,
        closedSessionId: session.id,
        approverId,
        report,
        anchorSeq: anchor.seq,
        anchorHash: anchor.hash,
      })
      .where(eq(shift.id, found.id));
    return report;
  },
  audit: (_input, output) => ({
    shiftId: output.shiftId,
    expectedCash: output.cash.expected,
    variances: output.variances,
    anchor: output.anchor,
  }),
  details: (_input, output) => ({ entity: "shift", entityId: output.shiftId }),
});

/** Variance per tender, declared − expected (negative is short); over the threshold on any tender needs a manager. */
function judge(report: XReport, declared: Declared, threshold: number) {
  const variances = report.tenders.map(({ tender, expected }) => ({
    tender,
    expected,
    declared: declared[tender],
    variance: sub(money(declared[tender]), money(expected)),
  }));
  const approvalRequired = variances.some((row) => Math.abs(row.variance) > threshold);
  return { variances, threshold, approvalRequired };
}

async function threshold(tx: TillSqlite, config: Prepared["config"]) {
  return (
    (await findRegisterSettings(tx, config))?.value.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD
  );
}

/** A payment taken into a basket would land in the drawer after the count. */
async function hasTenderedBasket(tx: TillSqlite, config: Prepared["config"]) {
  const [row] = await tx
    .select({ id: saleDraftTender.id })
    .from(saleDraftTender)
    .innerJoin(saleDraft, eq(saleDraft.id, saleDraftTender.draftId))
    .where(
      and(
        eq(saleDraft.orgId, config.orgId),
        eq(saleDraft.deviceId, config.deviceId),
        inArray(saleDraft.status, ["open", "held"]),
      ),
    )
    .limit(1);
  return !!row;
}

/** The last link of the till audit chain before the close writes its own: what Day 20 will publish. */
async function chainHead(tx: TillSqlite, orgId: string) {
  const [head] = await tx
    .select({ seq: tillAudit.chainSeq, hash: tillAudit.hash })
    .from(tillAudit)
    .where(and(eq(tillAudit.orgId, orgId), isNotNull(tillAudit.chainSeq)))
    .orderBy(desc(tillAudit.chainSeq))
    .limit(1);
  return head?.seq && head.hash
    ? { seq: head.seq, hash: head.hash }
    : { seq: 0, hash: GENESIS_HASH };
}
