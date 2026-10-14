import { handshake } from "./schemas/connection";
import * as v from "valibot";

import { negotiateProtocol } from "./versions";

export function readHandshake(raw: unknown, requestId: string, protocol: number) {
  const result = v.parse(handshake, raw);
  if (result.requestId !== requestId || negotiateProtocol(protocol, result.protocol) === undefined)
    throw new Error("Invalid handshake");
  return result;
}
