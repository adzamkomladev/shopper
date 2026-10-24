import type { XReport, ZReport } from "@shopper/core/schemas";
import { add, money, mulRatio, sub, toDecimal } from "@shopper/money";
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
  /** A tender's figures in the columns, or one per line when one is too wide, so no digit is ever cut. */
  const tenderRow = (label: string, cells: string[], headings: string[]) => {
    if (cells.every((cell) => cell.length <= width)) return printer.text(table(label, cells));
    printer.text(fit(label));
    cells.forEach((cell, index) => printer.text(row(`  ${headings[index]}`, cell)));
  };
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

  const headings = z ? ["Expected", "Declared", "Variance"] : ["Sales", "Refunds", "Expected"];
  printer.bold(true).text(table("", headings)).bold(false);
  for (const tender of report.tenders) {
    const counted = z?.variances.find((v) => v.tender === tender.tender);
    const cells = counted
      ? [counted.expected, counted.declared].map(decimal).concat(signed(counted.variance))
      : [tender.sales, tender.refunds, tender.expected].map(decimal);
    tenderRow(tenderLabel[tender.tender], cells, headings);
  }
  rule();

  const { account } = report;
  printer.text(row("On-account sales", ghs(money(account.sales))));
  printer.text(
    row("Account payments", ghs(add(money(account.payments.cash), money(account.payments.momo)))),
  );
  printer.text(row("  Cash", ghs(money(account.payments.cash))));
  printer.text(row("  MoMo", ghs(money(account.payments.momo))));
  printer.text(row("Refunds to accounts", ghs(money(account.refunds))));
  printer.text(row(`Points redeemed (${account.points})`, ghs(money(account.pointsValue))));
  rule();

  const { cash } = report;
  printer.text(row("Float", ghs(money(cash.float))));
  printer.text(row("Cash sales", ghs(money(cash.sales))));
  printer.text(row("Cash refunds", ghs(sub(money(0), money(cash.refunds)))));
  printer.text(row("Cash on accounts", ghs(money(report.account.payments.cash))));
  printer.text(row("Drops", ghs(sub(money(0), money(cash.drops)))));
  printer
    .bold(true)
    .text(row("Expected in drawer", ghs(money(cash.expected))))
    .bold(false);
  if (z) {
    rule();
    printer.text("Counted");
    for (const [face, count] of Object.entries(z.declared.counts).sort(([a], [b]) => +b - +a))
      if (count)
        printer.text(
          row(
            `${ghs(money(Number(face)))} x ${count}`,
            ghs(mulRatio(money(Number(face)), count, 1)),
          ),
        );
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
