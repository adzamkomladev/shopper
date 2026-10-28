import * as v from "valibot";

/** A `GET /bank?currency=GHS` item: a bank or mobile money provider a subaccount can settle to. */
export const bankSchema = v.object({ name: v.string(), code: v.string(), type: v.string() });

/** `GET /bank` answers every bank in one page when asked for enough. */
export const banksResponseSchema = v.object({ status: v.literal(true), data: v.array(bankSchema) });

/** `POST /subaccount`: the code charges name to pay the shop out. */
export const subaccountResponseSchema = v.object({
  status: v.literal(true),
  data: v.object({ subaccount_code: v.string() }),
});
