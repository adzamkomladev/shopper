import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { GENESIS_HASH } from "@shopper/audit";
import { deviceAudit, refund, sale, type ShopperDatabase } from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { ZReport } from "../schemas/till/shift";
import type { SaleSnapshot } from "../schemas/till/sale";
import { shiftTotals } from "./totals";

type Closed = {
  id: string;
  deviceId: string;
  openedAt: Date;
  closedAt: Date;
  anchorSeq: number;
  anchorHash: string;
  report: ZReport;
};
type ShiftChecks = {
  totals: { status: "matched" } | { status: "mismatch"; fields: string[] };
  anchor: "verified" | "pending" | "mismatch";
};

/**
 * Checks each Z against the server's own records, at read time so a late upload corrects itself. Totals: the
 * register's completed sales and refunds between the shift's open and close (device time, as the Z), summed by the
 * till's own `shiftTotals`. Anchor: the uploaded register chain's row at the Z's anchor seq.
 */
export async function shiftChecks(db: ShopperDatabase, orgId: string, shifts: Closed[]) {
  if (!shifts.length) return new Map<string, ShiftChecks>();
  const devices = [...new Set(shifts.map((s) => s.deviceId))];
  const from = new Date(Math.min(...shifts.map((s) => s.openedAt.getTime())));
  const to = new Date(Math.max(...shifts.map((s) => s.closedAt.getTime())));
  const sales = await db
    .select({ deviceId: sale.deviceId, at: sale.deviceTime, payload: sale.payload })
    .from(sale)
    .where(
      and(
        eq(sale.orgId, orgId),
        inArray(sale.deviceId, devices),
        eq(sale.status, "completed"),
        gte(sale.deviceTime, from),
        lte(sale.deviceTime, to),
      ),
    );
  const refunds = await db
    .select({
      deviceId: refund.deviceId,
      at: refund.deviceTime,
      total: refund.total,
      kind: refund.tenderKind,
      accountCredit: refund.accountCredit,
    })
    .from(refund)
    .where(
      and(
        eq(refund.orgId, orgId),
        inArray(refund.deviceId, devices),
        gte(refund.deviceTime, from),
        lte(refund.deviceTime, to),
      ),
    );
  const anchored = await db
    .select({ stream: deviceAudit.streamId, seq: deviceAudit.chainSeq, hash: deviceAudit.hash })
    .from(deviceAudit)
    .where(
      and(
        eq(deviceAudit.orgId, orgId),
        or(
          ...shifts.map((s) =>
            and(eq(deviceAudit.streamId, s.deviceId), eq(deviceAudit.chainSeq, s.anchorSeq)),
          ),
        ),
      ),
    );
  return new Map(
    shifts.map((s) => {
      // ponytail: membership by the register's clock, as the server's sales carry no shift id; a clock set back
      // mid-shift reads as a mismatch. Add the shift id to the sale event (a version bump) if that ever happens.
      const within = (row: { deviceId: string; at: Date }) =>
        row.deviceId === s.deviceId && row.at >= s.openedAt && row.at <= s.closedAt;
      const totals = shiftTotals({
        float: money(0),
        sales: sales.filter(within).map((row) => row.payload as SaleSnapshot),
        refunds: refunds.filter(within).map((row) => ({
          total: row.total,
          tender: { kind: row.kind },
          accountCredit: row.accountCredit,
        })) as never,
        drops: [],
        accountPayments: [],
      });
      const row = anchored.find((a) => a.stream === s.deviceId && a.seq === s.anchorSeq);
      const anchor =
        s.anchorSeq === 0
          ? s.anchorHash === GENESIS_HASH
            ? "verified"
            : "mismatch"
          : !row
            ? "pending"
            : row.hash === s.anchorHash
              ? "verified"
              : "mismatch";
      const fields = differences(s.report, totals);
      return [
        s.id,
        {
          totals: fields.length ? { status: "mismatch", fields } : { status: "matched" },
          anchor,
        } satisfies ShiftChecks,
      ];
    }),
  );
}

function differences(z: ZReport, server: ReturnType<typeof shiftTotals>) {
  const pairs: [string, number, number][] = [
    ["sales.count", z.sales.count, server.sales.count],
    ["sales.gross", z.sales.gross, server.sales.gross],
    ["sales.tax", z.sales.tax, server.sales.tax],
    ["refunds.count", z.refunds.count, server.refunds.count],
    ["refunds.total", z.refunds.total, server.refunds.total],
    ["account.sales", z.account.sales, server.account.sales],
    ["account.refunds", z.account.refunds, server.account.refunds],
    ["account.points", z.account.points, server.account.points],
    ["account.pointsValue", z.account.pointsValue, server.account.pointsValue],
    ...server.tenders.flatMap((t): [string, number, number][] => {
      const claimed = z.tenders.find((row) => row.tender === t.tender);
      return [
        [`${t.tender}.sales`, claimed?.sales ?? 0, t.sales],
        [`${t.tender}.refunds`, claimed?.refunds ?? 0, t.refunds],
      ];
    }),
  ];
  return pairs.filter(([, claimed, held]) => claimed !== held).map(([field]) => field);
}
