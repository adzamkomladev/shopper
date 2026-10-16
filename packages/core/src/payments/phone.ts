import * as v from "valibot";
import { sha256 } from "@shopper/utils";
import { momoPhone } from "./schemas/momo";

export function momoPhoneFingerprint(phone: string): Promise<string> {
  return sha256(v.parse(momoPhone, phone));
}
