import * as v from "valibot";

const day = v.pipe(v.string(), v.isoDate());
const word = v.pipe(v.string(), v.maxLength(100));

/** The Log tab's address: every filter, and the entry open in the sheet, so links and back/forward hold. */
export const auditSearch = v.object({
  actor: v.optional(word),
  role: v.optional(word),
  device: v.optional(word),
  branch: v.optional(word),
  entity: v.optional(word),
  entityId: v.optional(word),
  command: v.optional(word),
  from: v.optional(day),
  to: v.optional(day),
  entry: v.optional(word),
});
export type AuditSearch = v.InferOutput<typeof auditSearch>;

const named = v.nullable(v.object({ id: v.string(), name: v.nullable(v.string()) }));
const item = v.object({
  id: v.string(),
  stream: v.string(),
  streamName: v.nullable(v.string()),
  seq: v.number(),
  at: v.string(),
  deviceTime: v.nullable(v.string()),
  command: v.string(),
  entity: v.nullable(v.string()),
  entityId: v.nullable(v.string()),
  role: v.nullable(v.string()),
  reason: v.nullable(v.string()),
  actor: named,
  approver: named,
  device: named,
  branch: named,
});
export type AuditItem = v.InferOutput<typeof item>;
export const auditPage = v.object({ entries: v.array(item), next: v.nullable(v.string()) });
export const auditDetail = v.object({
  ...item.entries,
  before: v.unknown(),
  after: v.unknown(),
  payload: v.record(v.string(), v.unknown()),
  hash: v.string(),
  prevHash: v.string(),
  appVersion: v.string(),
});
export type AuditDetail = v.InferOutput<typeof auditDetail>;

const option = v.object({ id: v.string(), name: v.nullable(v.string()) });
export const auditFacets = v.object({
  actors: v.array(option),
  devices: v.array(option),
  branches: v.array(option),
  commands: v.array(v.string()),
  entities: v.array(v.string()),
  roles: v.array(v.string()),
});
export type AuditFacets = v.InferOutput<typeof auditFacets>;

const head = v.object({ seq: v.number(), hash: v.string() });
export const auditStreams = v.array(
  v.object({
    stream: v.string(),
    name: v.nullable(v.string()),
    count: v.number(),
    head: v.nullable(head),
    anchor: v.nullable(v.object({ day: v.string(), seq: v.number(), hash: v.string() })),
  }),
);
export type AuditStream = v.InferOutput<typeof auditStreams>[number];
export const streamVerification = v.variant("valid", [
  v.object({ valid: v.literal(true), count: v.number(), head: v.nullable(head) }),
  v.object({
    valid: v.literal(false),
    entryId: v.nullable(v.string()),
    seq: v.nullable(v.number()),
    reason: v.string(),
  }),
]);
export type StreamVerification = v.InferOutput<typeof streamVerification>;
/** Where a chain's check stands: never asked, being asked, the verdict, or the request failed. */
export type Verdict = "checking" | StreamVerification | { failed: string } | undefined;
