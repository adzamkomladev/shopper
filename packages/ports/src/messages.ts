import * as v from "valibot";
import {
  MAX_MESSAGE_BYTES,
  jsonSchema,
  sequenceSchema,
  uuidV7Schema,
  type Json,
  type RetryPolicy,
} from "./schemas/primitives";

export interface Envelope {
  id: string;
  orgId: string;
  v: number;
  sequence: string; // Decimal bigint; consumers never rely on delivery order.
  type: string;
  payload: Json;
}
export function messageBody(message: Envelope): string {
  v.parse(
    v.object({
      id: uuidV7Schema,
      orgId: uuidV7Schema,
      v: v.pipe(v.number(), v.integer(), v.minValue(1)),
      sequence: sequenceSchema,
      type: v.pipe(v.string(), v.minLength(1)),
      payload: jsonSchema,
    }),
    message,
  );
  const body = JSON.stringify(message);
  if (new TextEncoder().encode(body).byteLength > MAX_MESSAGE_BYTES) {
    throw new RangeError("Message exceeds 96 KB; put the payload in Blobs and send a reference");
  }
  return body;
}
export interface Delivery {
  message: Envelope;
  attempts: number;
  ack(): Promise<void>; // Explicit acknowledgement, never on handler return.
  retry(): Promise<void>; // Apply policy; exhausted messages go to the dead-letter path.
}
export interface Queue {
  readonly policy: RetryPolicy;
  send(message: Envelope): Promise<void>;
  consume(handler: (delivery: Delivery) => Promise<void>): Promise<void>;
}
