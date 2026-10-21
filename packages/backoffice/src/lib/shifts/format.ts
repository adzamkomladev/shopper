import { formatGHS, money, toDecimal } from "@shopper/money";
import { SHOP_TIME_ZONE } from "../shop/time";

const when = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});
const day = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TIME_ZONE, dateStyle: "short" });
const clock = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TIME_ZONE, timeStyle: "short" });

/** Whether two moments fall on the same shop day. */
export const sameShopDay = (a: string, b: string) =>
  day.format(new Date(a)) === day.format(new Date(b));

/** Shop time (Ghana is GMT all year), like "Oct 15, 2026, 8:00 AM". */
export const shiftTime = (iso: string) => when.format(new Date(iso));
export const shiftClock = (iso: string) => clock.format(new Date(iso));

export const tenderName = { cash: "Cash", card: "Card", momo: "Mobile money" } as const;

/** A face like "GH₵ 20" or "GH₵ 0.50": whole cedis without decimals. */
export const denominationLabel = (face: number) =>
  `GH₵ ${toDecimal(money(face)).replace(/\.00$/, "")}`;

/** Notes from GH₵ 5 up, coins below GH₵ 1, and GH₵ 2 and 1 can be either. */
export const denominationKind = (face: number) =>
  face >= 50_000 ? "Note" : face >= 10_000 ? "Note or coin" : "Coin";

/** The drawer against the count: Balanced, or Short or Over by the difference. */
export const varianceLabel = (variance: number) =>
  variance === 0
    ? "Balanced"
    : variance < 0
      ? `Short ${formatGHS(money(-variance))}`
      : `Over ${formatGHS(money(variance))}`;

/** A SHA-256 in groups of 16 so it can be read aloud and compared with the printout. */
export const anchorGroups = (hash: string) => hash.match(/.{1,16}/g)?.join(" ") ?? hash;

/** Money taken out, with a true minus; nothing taken out is plain zero, not "−GH₵ 0.00". */
export const deduction = (amount: number) =>
  amount === 0 ? formatGHS(money(0)) : `−${formatGHS(money(amount))}`;
