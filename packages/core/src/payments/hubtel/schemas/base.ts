import * as v from "valibot";

/** Hubtel's channel names for the three Ghanaian MoMo networks. */
export const HUBTEL_CHANNELS = {
  mtn: "mtn-gh",
  telecel: "vodafone-gh",
  airteltigo: "tigo-gh",
} as const;

/** Amounts arrive as JSON numbers in cedis; two decimal places is what Hubtel ever sends. */
const cedis = v.pipe(v.number(), v.minValue(0));

export const receiveResponseSchema = v.object({
  ResponseCode: v.string(),
  Message: v.optional(v.nullable(v.string())),
  Data: v.optional(
    v.nullable(
      v.object({
        TransactionId: v.optional(v.nullable(v.string())),
        Description: v.optional(v.nullable(v.string())),
      }),
    ),
  ),
});

export const statusResponseSchema = v.object({
  responseCode: v.string(),
  message: v.optional(v.nullable(v.string())),
  data: v.optional(
    v.nullable(
      v.object({
        status: v.string(),
        amount: cedis,
        charges: v.optional(cedis),
        transactionId: v.optional(v.nullable(v.string())),
        clientReference: v.string(),
      }),
    ),
  ),
});

/** The callback Hubtel POSTs to the payment's callback URL. It is unsigned: the status API decides. */
export const callbackSchema = v.object({
  ResponseCode: v.string(),
  Data: v.object({
    ClientReference: v.string(),
    TransactionId: v.optional(v.nullable(v.string())),
    Amount: cedis,
    Description: v.optional(v.nullable(v.string())),
  }),
});
