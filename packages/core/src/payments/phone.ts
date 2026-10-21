import * as v from "valibot";
import { sha256 } from "@shopper/utils";
import { ghanaPhone } from "../schemas/fields";

export function momoPhoneFingerprint(phone: string): Promise<string> {
  return sha256(v.parse(ghanaPhone, phone));
}
