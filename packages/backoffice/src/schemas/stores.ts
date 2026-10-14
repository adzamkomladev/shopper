import * as v from "valibot";

import { storeView } from "./management";
export const storeList = v.array(storeView);

export const deletedStore = v.null();
