import * as v from "valibot";
import { defineCommand } from "@shopper/audit/sqlite";
import { reference } from "@shopper/db-sqlite";
import { tillReference } from "../schemas/till/reference";
import { TillError } from "./error";
import { projectProducts } from "./lookup/project";

export const provisionTillReference = defineCommand({
  name: "till.reference.provision",
  async run(tx, context, input: unknown) {
    const data = v.parse(tillReference, input);
    const groups = { product: data.products, price: data.prices, "tax-rule": data.taxRules };
    let count = 0;
    for (const [entity, rows] of Object.entries(groups)) {
      for (const payload of rows) {
        if (payload.orgId !== context.orgId)
          throw new TillError("scope", "Reference org is outside the tenant scope");
        await tx
          .insert(reference)
          .values({ id: payload.id, orgId: context.orgId, entity, payload })
          .onConflictDoUpdate({
            target: [reference.orgId, reference.entity, reference.id],
            set: { payload },
          });
        count += 1;
      }
    }
    await projectProducts(tx, context.orgId, data.products);
    return { count };
  },
  audit: (_input, output) => output,
});
