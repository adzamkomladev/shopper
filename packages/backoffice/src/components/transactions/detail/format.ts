import { formatQuantity } from "@shopper/utils";

const dateTime = new Intl.DateTimeFormat("en-GH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "2 Oct 2026, 11:42 am" in shop time (UTC). */
export const dateTimeLabel = (iso: string) => dateTime.format(new Date(iso));

export const quantity = (thousandths: number) => formatQuantity(thousandths);
