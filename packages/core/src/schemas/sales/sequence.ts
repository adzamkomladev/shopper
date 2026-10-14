import * as v from "valibot";

import { uuidV7Schema } from "@shopper/ports";

export const saleSequenceInput = v.object({
  storeId: uuidV7Schema,
  deviceId: uuidV7Schema,
  localId: uuidV7Schema,
});
