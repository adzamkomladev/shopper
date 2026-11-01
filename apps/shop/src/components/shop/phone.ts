/** 0241234567 as a shopper reads it back on screen with the middle hidden: 024 *** 4567. */
export const maskPhone = (phone: string) => `${phone.slice(0, 3)} *** ${phone.slice(-4)}`;

/** Shop time is Accra time (GMT all year), whatever zone the phone is set to. */
export const shopDate = (iso: string, style: "day" | "full" = "day") =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(style === "full" ? { year: "numeric", hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
