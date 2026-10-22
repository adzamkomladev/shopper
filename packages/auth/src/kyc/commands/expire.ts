import { defineCommand } from "@shopper/audit";
import { caseDeadline, closeAsExpired, isOpen, readCaseRow } from "../records";

/**
 * Closes a case's workflow run, expiring the case first when it is still open and past its deadline. `force` is
 * for a workflow that failed: the case must not stay open behind a run that will never finish it. Closing a case
 * that was decided in time changes nothing, so it leaves no entity in the audit.
 */
export const expireCase = defineCommand({
  name: "kyc.expire",
  async run(tx, context, input: { id: string; force: boolean; now: Date }) {
    const row = await readCaseRow(tx, context.orgId, input.id, true);
    const deadline = caseDeadline(row);
    const expired = isOpen(row) && (input.force || (deadline !== null && deadline <= input.now));
    if (expired) await closeAsExpired(tx, row);
    return { id: row.id, expired };
  },
  audit: (_input, output) => ({ id: output.id, expired: output.expired }),
  details: (_input, output) => (output.expired ? { entity: "kyc_case", entityId: output.id } : {}),
});
