import { money } from "@shopper/money";
import { ghs, tenderLabel } from "../format";
import { paper } from "../profiles";
import type { AccountPaymentSlip, PaperMm, PrinterProfile } from "../types";
import { ascii, escpos } from "./encoder";

/** A minimal slip for money paid onto a customer's account. The new balance is not on it: offline, the till cannot know it. */
export function encodeAccountPayment(
  slip: AccountPaymentSlip,
  options: { profile: PrinterProfile; paperMm: PaperMm },
): Uint8Array {
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
  printer.init();
  // Cash goes in the drawer.
  if (slip.method === "cash") printer.drawer();
  printer.align("center").bold(true).text(fit(slip.shopName));
  printer.size(2, 2).text("ACCOUNT PAYMENT").size(1, 1).bold(false);
  printer.text(fit(slip.registerName));
  printer.align("left").text("-".repeat(cols));
  printer.text(row("Date", slip.at));
  printer.text(row("Cashier", slip.cashierName));
  printer.text(fit(`Customer ${slip.customerName}`));
  printer.text("-".repeat(cols));
  printer
    .bold(true)
    .text(row(tenderLabel[slip.method], ghs(money(slip.amount))))
    .bold(false);
  if (slip.reference) printer.text(fit(`  Ref ${slip.reference}`));
  printer.feed(1).align("center").text("Thank you");
  return printer.cut().bytes();
}
