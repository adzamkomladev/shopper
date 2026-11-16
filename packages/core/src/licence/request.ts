import * as v from "valibot";
import { fromBase64Url } from "./keys";
import { issueLicence } from "./licence";
import { requestCode, type Licence } from "./schemas/base";

/**
 * Turns the request code a box shows (Settings → Licence, or its first-boot wizard) into its signed lic/1. Undefined
 * for a code that is not one: it is pasted by a person.
 */
export async function licenceFromRequest(
  issuerKey: string,
  request: string,
  fields: Omit<Licence, "format" | "signature" | "machine" | "key">,
) {
  const decoded = v.safeParse(
    requestCode,
    parse(() => JSON.parse(new TextDecoder().decode(fromBase64Url(request.trim())))),
  );
  if (!decoded.success) return undefined;
  return issueLicence(issuerKey, {
    ...fields,
    machine: decoded.output.machine,
    key: decoded.output.key,
  });
}

function parse(read: () => unknown) {
  try {
    return read();
  } catch {
    return undefined;
  }
}
