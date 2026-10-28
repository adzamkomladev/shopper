import * as v from "valibot";

/** The limits the host enforces on `device.enrol`, so a malformed code never reaches the bridge. */
export const enrolForm = v.object({
  shopCode: v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.nonEmpty("Enter the shop code from the portal"),
    v.maxLength(64, "Use 64 characters or fewer"),
  ),
  // The portal shows the code as "424 242"; spaces typed with it are not part of it.
  code: v.pipe(
    v.string(),
    v.transform((value) => value.replace(/\s/g, "")),
    v.regex(/^\d{6}$/, "Enter the 6-digit code from the portal"),
  ),
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Name this till, like Till 1"),
    v.maxLength(200, "Use 200 characters or fewer"),
  ),
});

export type EnrolInput = v.InferOutput<typeof enrolForm>;
export type EnrolErrors = Partial<Record<keyof EnrolInput, string>>;

/** What the portal's QR holds once a keyboard-wedge scanner has typed it: `shopper:enrol?shop=…&code=…`. */
export const enrolQr = v.pipe(
  v.string(),
  v.regex(/^shopper:enrol\?/),
  v.transform((value) => new URLSearchParams(value.slice("shopper:enrol?".length))),
  v.transform((params) => ({ shop: params.get("shop") ?? "", code: params.get("code") ?? "" })),
  v.check((qr) => qr.shop !== "" && /^\d{6}$/.test(qr.code)),
);
