import * as v from "valibot";

/** A Ghanaian mobile number as people type it (+233 24…, 233…, 024 …) stored as 0XXXXXXXXX. */
export const shopPhone = v.pipe(
  v.string(),
  v.transform((raw) => raw.replace(/[\s()-]/g, "").replace(/^\+?233/, "0")),
  v.regex(/^0[0-9]{9}$/, "Enter a 10-digit phone number"),
);

/** Six digits, as typed or pasted. */
export const shopCode = v.pipe(v.string(), v.trim(), v.regex(/^[0-9]{6}$/, "Enter the 6-digit code"));
