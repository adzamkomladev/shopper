import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { canonicalJson, defineCommand } from "@shopper/audit";
import { shift, shiftMovement, shiftTender, type ShopperDatabase } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { sha256 } from "@shopper/utils";
import { shiftClosedEvent, type ShiftClosedEvent } from "../schemas/till/shift";
import { SaleError } from "../sales/error";
import type { UploadPrincipal } from "../sales/types";
import { validateShiftAuthority } from "./authority";
import { validateShiftReport } from "./validate";

type Input = {
  principal: UploadPrincipal;
  event: ShiftClosedEvent;
  proofHash: string;
  contentHash: string;
};

/** Records a till's closed shift once: its Z, a row per tender and its cash movements, audited. */
export async function acceptShift(
  db: ShopperDatabase,
  principal: UploadPrincipal,
  raw: unknown,
  proof: string,
) {
  const event = v.parse(shiftClosedEvent, raw);
  const { report } = event.shift;
  return accept(
    db,
    {
      orgId: principal.orgId,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      actorId: report.closedBy,
      appVersion: report.appVersion,
      deviceTime: new Date(report.closedAt),
    },
    {
      principal,
      event,
      proofHash: await sha256(proof),
      contentHash: await sha256(canonicalJson(event.shift)),
    },
  );
}

const accept = defineCommand({
  name: "shift.accept",
  async replay(tx, ctx, input: Input) {
    const [saved] = await tx
      .select()
      .from(shift)
      .where(and(eq(shift.orgId, ctx.orgId), eq(shift.id, input.event.shift.report.shiftId)));
    if (!saved) return undefined;
    await validateShiftAuthority(tx, ctx, input.principal, input.event.shift, input.proofHash);
    if (saved.contentHash !== input.contentHash)
      throw new SaleError("CONFLICT", "Shift identity already has different content");
    return { output: output(saved) };
  },
  async run(tx, ctx, input) {
    const { sessionId, report } = input.event.shift;
    await validateShiftAuthority(tx, ctx, input.principal, input.event.shift, input.proofHash);
    validateShiftReport(report);
    const [saved] = await tx
      .insert(shift)
      .values({
        id: report.shiftId,
        orgId: ctx.orgId,
        deviceId: report.deviceId,
        storeId: report.storeId,
        branchId: report.branchId,
        openedAt: new Date(report.openedAt),
        openedBy: report.openedBy,
        closedAt: new Date(report.closedAt),
        closedBy: report.closedBy,
        sessionId,
        approverId: report.approverId,
        float: money(report.cash.float),
        varianceThreshold: money(report.threshold),
        expectedCash: money(report.cash.expected),
        declaredCash: money(report.declared.cash),
        report,
        anchorSeq: report.anchor.seq,
        anchorHash: report.anchor.hash,
        eventVersion: input.event.v,
        contentHash: input.contentHash,
      })
      .returning();
    await tx.insert(shiftTender).values(
      report.tenders.map((t, index) => ({
        orgId: ctx.orgId,
        shiftId: report.shiftId,
        tender: t.tender,
        sales: money(t.sales),
        refunds: money(t.refunds),
        expected: money(t.expected),
        declared: money(report.variances[index]!.declared),
        variance: money(report.variances[index]!.variance),
      })),
    );
    if (report.movements.length)
      await tx.insert(shiftMovement).values(
        report.movements.map((m) => ({
          orgId: ctx.orgId,
          shiftId: report.shiftId,
          kind: m.kind,
          amount: money(m.amount),
          reason: m.reason,
          actorId: m.actorId,
          at: new Date(m.at),
        })),
      );
    return output(saved!);
  },
  audit: (input, result) => ({
    ...result,
    expectedCash: input.event.shift.report.cash.expected,
    variances: input.event.shift.report.variances,
    anchor: input.event.shift.report.anchor,
  }),
  details: (_input, result) => ({ entity: "shift", entityId: result.id }),
});

const output = (saved: typeof shift.$inferSelect) => ({
  id: saved.id,
  closedAt: saved.closedAt.toISOString(),
});
