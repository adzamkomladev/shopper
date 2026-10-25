import * as v from "valibot";

/** One page of a till's provisional receipts; the till sends more pages for more. */
export const SIGNATURES_PAGE = 500;
const ids = v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.maxLength(SIGNATURES_PAGE));

export const signaturesRequest = v.strictObject({ saleIds: ids, refundIds: ids });
