import { formatGHS, money } from "@shopper/money";

const accra = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Accra", ...options });
const timeOfDay = accra({ hour: "2-digit", minute: "2-digit" });
const day = accra({ dateStyle: "medium" });
const dayAndTime = accra({ dateStyle: "medium", timeStyle: "short" });

/** Accra time, like "09:30 AM". */
export const accraTime = (value: string) => timeOfDay.format(new Date(value));
/** An Accra date, like "Nov 14, 2026". */
export const accraDay = (value: string) => day.format(new Date(value));
export const accraDateTime = (value: string) => dayAndTime.format(new Date(value));

export const tenderLabel = (kind: string) =>
  kind === "momo" ? "Mobile money" : kind[0]!.toUpperCase() + kind.slice(1);

export const statusLabel = (status: string) =>
  status === "returned" ? "Returned" : status[0]!.toUpperCase() + status.slice(1);

/** Money with its sign: a refund is a negative total, drawn with a true minus. */
export const formatSigned = (amount: number) =>
  amount < 0 ? `−${formatGHS(money(-amount))}` : formatGHS(money(amount));
