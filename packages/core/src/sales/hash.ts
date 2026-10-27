import { canonicalJson } from "@shopper/audit";
import { sha256 } from "@shopper/utils";
import type { SaleSnapshot } from "../schemas/till/sale";

/**
 * A sale's content hash, the same on the till and the server. A sale without a remote discount approval hashes as
 * it did before v7, so one accepted before the upgrade replays as itself.
 */
export async function saleContentHash(sale: SaleSnapshot) {
  const { discountApprovalId, ...unapproved } = sale;
  return sha256(canonicalJson(discountApprovalId ? sale : unapproved));
}
