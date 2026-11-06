import * as v from "valibot";

const id = v.pipe(v.string(), v.uuid(), v.toLowerCase());

/** What starts an online order's workflow; its instance id is the order id. */
export const orderParams = v.object({ orgId: id, id });
