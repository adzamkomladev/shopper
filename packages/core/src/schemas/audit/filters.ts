import * as v from "valibot";
import { timestamp } from "../fields";

const id = v.pipe(v.string(), v.uuid(), v.toLowerCase());
const word = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100));

/** The viewer's query string: every filter optional, `from` inclusive and `to` exclusive, newest first. */
export const auditFilters = v.object({
  actor: v.optional(id),
  role: v.optional(word),
  device: v.optional(id),
  branch: v.optional(id),
  entity: v.optional(word),
  entityId: v.optional(v.pipe(v.string(), v.trim(), v.toLowerCase(), v.maxLength(100))),
  command: v.optional(word),
  from: v.optional(timestamp),
  to: v.optional(timestamp),
  cursor: v.optional(id),
  limit: v.optional(
    v.pipe(v.string(), v.digits(), v.transform(Number), v.minValue(1), v.maxValue(500)),
    "50",
  ),
});

export type AuditFilters = v.InferOutput<typeof auditFilters>;
