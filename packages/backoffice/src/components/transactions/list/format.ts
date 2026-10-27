const TENDER_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  momo: "MoMo",
  credit: "Store credit",
  loyalty: "Loyalty points",
};

export const tenderLabel = (kind: string) => TENDER_LABELS[kind] ?? kind;

/** "Cash", or "Cash + MoMo" for a split payment. */
export const tendersLabel = (kinds: string[]) => kinds.map(tenderLabel).join(" + ") || "—";

const time = new Intl.DateTimeFormat("en-GH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const date = new Intl.DateTimeFormat("en-GH", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "11:31 am" on the range's only day, else "2 Oct · 11:31 am" (shop time is UTC). */
export const occurredLabel = (iso: string, oneDay: boolean) =>
  oneDay
    ? time.format(new Date(iso))
    : `${date.format(new Date(iso))} · ${time.format(new Date(iso))}`;
