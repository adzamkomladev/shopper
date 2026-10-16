import * as v from "valibot";
import { momoView } from "@shopper/core/payments";
export const momoList = v.object({ payments: v.array(momoView) });
