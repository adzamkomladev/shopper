import * as v from "valibot";
import { SdcUnavailable, type Sdc } from "@shopper/ports";
import { sdcAcceptedSchema, sdcRejectedSchema } from "./schemas/sdc";
import type { SdcOptions } from "./types";

/**
 * The GRA E-VAT SDC over HTTP, built against the mock contract until sandbox access is granted. Plain fetch, so the
 * Worker, the box and the tests share it.
 */
export function createSdc({ url, apiKey, fetch: fetcher = fetch }: SdcOptions): Sdc {
  return {
    async submit(submission) {
      const response = await fetcher(`${url}/api/v1/invoices`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify(submission),
        signal: AbortSignal.timeout(15_000),
      }).catch((error: unknown) => {
        throw new SdcUnavailable("The SDC could not be reached", { cause: error });
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (response.status === 200) {
        const accepted = v.safeParse(sdcAcceptedSchema, body);
        if (accepted.success) return accepted.output;
      }
      if (response.status === 422) {
        const rejected = v.safeParse(sdcRejectedSchema, body);
        if (rejected.success) return rejected.output;
      }
      throw new SdcUnavailable(`The SDC replied ${response.status}`);
    },
  };
}
