import * as v from "valibot";
import { timestamp } from "../fields";

const id = v.pipe(v.string(), v.uuid());
const hash = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/));
const json = v.unknown();

/** One till audit row as the till serialized it: every hashed field, nothing derived. */
export const deviceAuditEntry = v.strictObject({
  id,
  orgId: id,
  actorId: v.nullable(id),
  role: v.nullable(v.string()),
  deviceId: v.nullable(id),
  branchId: v.nullable(id),
  approverId: v.nullable(id),
  reason: v.nullable(v.string()),
  deviceTime: v.nullable(timestamp),
  entity: v.nullable(v.string()),
  entityId: v.nullable(v.string()),
  before: json,
  after: json,
  appVersion: v.string(),
  command: v.pipe(v.string(), v.minLength(1)),
  payload: v.record(v.string(), json),
  chainSeq: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  prevHash: hash,
  hash,
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** `POST /sync/audit`: consecutive rows of the uploading till's chain, oldest first. */
export const deviceAuditUpload = v.strictObject({
  requestId: id,
  entries: v.pipe(v.array(deviceAuditEntry), v.minLength(1), v.maxLength(200)),
});

export type DeviceAuditEntry = v.InferOutput<typeof deviceAuditEntry>;
