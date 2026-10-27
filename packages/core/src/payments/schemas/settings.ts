import * as v from "valibot";

export const paymentSettings = v.strictObject({ momoProvider: v.picklist(["paystack", "hubtel"]) });
