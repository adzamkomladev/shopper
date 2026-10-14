import { envelopeSchema } from "./schemas/messages";
import type { Envelope } from "./types";
export type { Envelope, Delivery, Queue } from "./types";
import * as v from "valibot";
import { MAX_MESSAGE_BYTES } from "./schemas/primitives";

export function messageBody(message: Envelope): string {
  v.parse(envelopeSchema, message);
  const body = JSON.stringify(message);
  if (new TextEncoder().encode(body).byteLength > MAX_MESSAGE_BYTES) {
    throw new RangeError("Message exceeds 96 KB; put the payload in Blobs and send a reference");
  }
  return body;
}
