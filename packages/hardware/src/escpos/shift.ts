import type { XReport, ZReport } from "@shopper/core/schemas";
import { money, toDecimal } from "@shopper/money";
import { ghs, tenderLabel } from "../format";
import { paper } from "../profiles";
import type { PaperMm, PrinterProfile } from "../types";
import { ascii, escpos } from "./encoder";

type Options = {
  profile: PrinterProfile;
  paperMm: PaperMm;
  /** Display names by user id, for people the report knows only by id (the approver). */
  names?: Record<string, string>;
};

/**
 * The X (mid-shift, closes nothing) or Z (close) printout. The Z adds the declared count, the variance per tender,
 * the approver and, last, the audit chain head it closed on.
 */
export function encodeShiftReport(report: XReport | ZReport, options: Options): Uint8Array {
  const { cols } = paper[options.paperMm];
  const printer = escpos(options.profile, options.paperMm);
  const fit = (value: string) => ascii(value).slice(0, cols);
  const row = (left: string, right: string) => {
    const end = ascii(right).slice(0, cols - 2);
    return (
      ascii(left)
        .slice(0, cols - end.length - 1)
        .padEnd(cols - end.length) + end
    );
  };
  // A label column, then three right-aligned figure columns.
  const width = Math.floor((cols - 5) / 3);
  const table = (label: string, cells: string[]) =>
    fit(label.padEnd(cols - width * 3) + cells.map((cell) => cell.padStart(width)).join(""));
  const rule = () => printer.text("-".repeat(cols));
  const name = (userId: string) =>
    options.names?.[userId] ??
    report.cashiers.find((c) => c.userId === userId)?.name ??
    userId.slice(0, 8);
  const z = report.kind === "z" ? report : null;

  printer.init().align("center").bold(true).size(2, 2);
  printer
    .text(z ? "Z REPORT" : "X REPORT")
    .size(1, 1)
    .bold(false);
  printer.text(fit(report.registerName ?? `Register ${report.deviceId.slice(0, 8)}`));
  if (!z) printer.text(fit("Shift still open - not a close"));
  printer.align("left");
  printer.text(row("Opened", time(report.openedAt)));
  printer.text(row(z ? "Closed" : "Printed", time(z ? z.closedAt : report.at)));
  rule();
  printer.text(row(`Sales (${report.sales.count})`, ghs(money(report.sales.gross))));
  printer.text(row("  of which tax", ghs(money(report.sales.tax))));
  printer.text(row(`Refunds (${report.refunds.count})`, ghs(money(report.refunds.total))));
  rule();

  printer.bold(true);
  printer.text(
    table("", z ? ["Expected", "Declared", "Variance"] : ["Sales", "Refunds", "Expected"]),
  );
  printer.bold(false);
  for (const tender of report.tenders) {
    const counted = z?.variances.find((v) => v.tender === tender.tender);
    const cells = counted
      ? [counted.expected, counted.declared].map(decimal).concat(signed(counted.variance))
      : [tender.sales, tender.refunds, tender.expected].map(decimal);
    printer.text(table(tenderLabel[tender.tender], cells));
  }
  rule();

  const { cash } = report;
  printer.text(row("Float", ghs(money(cash.float))));
  printer.text(row("Cash sales", ghs(money(cash.sales))));
  printer.text(row("Cash refunds", ghs(money(-cash.refunds))));
  printer.text(row("Drops", ghs(money(-cash.drops))));
  printer
    .bold(true)
    .text(row("Expected in drawer", ghs(money(cash.expected))))
    .bold(false);
  if (z) {
    rule();
    printer.text("Counted");
    for (const [face, count] of Object.entries(z.declared.counts).sort(([a], [b]) => +b - +a))
      if (count) printer.text(row(`${ghs(money(+face))} x ${count}`, ghs(money(+face * count))));
    printer
      .bold(true)
      .text(row("Counted cash", ghs(money(z.declared.cash))))
      .bold(false);
  }
  if (report.movements.length) {
    rule();
    for (const m of report.movements) {
      const label = m.kind === "drop" ? "Drop" : "No sale";
      printer.text(
        row(
          `${label} ${time(m.at).slice(11)} ${name(m.actorId)}`,
          m.kind === "drop" ? ghs(money(m.amount)) : "",
        ),
      );
      if (m.reason) printer.text(fit(`  ${m.reason}`));
    }
  }
  rule();
  printer.text("Cashiers");
  for (const cashier of report.cashiers) printer.text(fit(`  ${name(cashier.userId)}`));
  if (z) {
    printer.text(row("Variance allowed", ghs(money(z.threshold))));
    printer.text(fit(z.approverId ? `Approved by ${name(z.approverId)}` : "No approval needed"));
    rule();
    printer.align("center").text(`Audit anchor #${z.anchor.seq}`);
    for (let at = 0; at < z.anchor.hash.length; at += 16)
      printer.text(z.anchor.hash.slice(at, at + 16));
  }
  return printer.cut().bytes();
}

/** The page Settings prints to prove the printer, the paper and the connection. */
export function encodeTestPage(
  profile: PrinterProfile,
  paperMm: PaperMm,
  model: string,
  connection: string,
): Uint8Array {
  return escpos(profile, paperMm)
    .init()
    .align("center")
    .bold(true)
    .text("Printer test")
    .bold(false)
    .text(`Model: ${model}`)
    .text(`Paper: ${paperMm} mm (${paper[paperMm].cols} columns)`)
    .text(connection)
    .cut()
    .bytes();
}

const decimal = (amount: number) => toDecimal(money(amount));
const signed = (amount: number) => (amount > 0 ? `+${decimal(amount)}` : decimal(amount));
/** Accra is UTC all year. */
const time = (iso: string) => iso.slice(0, 16).replace("T", " ");
