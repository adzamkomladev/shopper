import { parseArgs } from "node:util";
import { v7 } from "uuid";
import { licenceFromRequest } from "../../packages/core/src/licence/index";

/**
 * Turns a box's request code (Settings → Licence) into its signed `licence.json`. The issuer's private JWK comes from
 * `SHOPPER_LICENCE_SIGNING_KEY`, the edge secret that also confirms check-ins.
 * `vpx tooling/licence/issue.ts --request <code> --org <id> --site "Accra Mall" --terminals 5 --maintenance 2027-11-01`
 */
export async function issueFromRequest(
  issuerKey: string,
  request: string,
  fields: { org: string; site: string; terminals: number; maintenanceUntil: string },
  now = new Date(),
) {
  const licence = await licenceFromRequest(issuerKey, request, {
    id: v7(),
    ...fields,
    issuedAt: now.toISOString(),
  });
  if (!licence) throw new Error("That is not a box's request code");
  return licence;
}

if (import.meta.main) {
  const args = parseArgs({
    options: {
      request: { type: "string" },
      org: { type: "string" },
      site: { type: "string" },
      terminals: { type: "string", default: "5" },
      maintenance: { type: "string" },
    },
  }).values;
  const key = process.env.SHOPPER_LICENCE_SIGNING_KEY;
  if (!key || !args.request || !args.org || !args.site || !args.maintenance)
    throw new Error(
      "Usage: SHOPPER_LICENCE_SIGNING_KEY=… vpx tooling/licence/issue.ts --request <code> --org <id> --site <name> --maintenance <yyyy-mm-dd> [--terminals 5]",
    );
  const licence = await issueFromRequest(key, args.request, {
    org: args.org,
    site: args.site,
    terminals: Number(args.terminals),
    maintenanceUntil: args.maintenance,
  });
  console.log(JSON.stringify(licence, null, 2));
}
