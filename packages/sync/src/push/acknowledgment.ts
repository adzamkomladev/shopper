import { acknowledgment } from "../schemas/push/acknowledgment";
export { acknowledgment } from "../schemas/push/acknowledgment";
import * as v from "valibot";

export function readAcknowledgment(raw: unknown, requestId: string, submitted: string[]) {
  const parsed = v.parse(acknowledgment, raw);
  if (parsed.requestId !== requestId) throw new Error("Uncorrelated acknowledgment");
  const ids = [...parsed.accepted, ...parsed.rejected].map((entry) => entry.localId);
  if (new Set(ids).size !== ids.length || ids.some((id) => !submitted.includes(id)))
    throw new Error("Invalid acknowledgment membership");
  return parsed;
}
