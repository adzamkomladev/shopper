import * as v from "valibot";
import { enrollmentResult } from "@shopper/auth/schemas";
import { verifyRelocation } from "@shopper/core/licence";
import { buildInfo } from "@shopper/config";

/** How long a register waits before asking again while the cloud is still importing its shop. */
const STILL_MOVING_MS = 15_000;

/**
 * The box handed this register a relocation. Only one the issuer signed, for this register and not expired, is
 * followed: the register claims its place in the cloud with the one-time code and gets a token for the same device.
 * Returns what the register file needs next (the cloud as its server, no box CA), or undefined for a message it
 * must ignore. Its outbox stays as it is and goes to the cloud once the register restarts there.
 */
export async function relocateRegister(
  identity: { orgId: string; deviceId: string },
  message: unknown,
  options: {
    issuer: string;
    fetch?: (request: Request) => Promise<Response>;
    wait?: (ms: number) => Promise<void>;
    now?: () => Date;
  },
) {
  const relocation = await verifyRelocation(options.issuer, message, identity, options.now?.());
  if (!relocation) return undefined;
  const send = options.fetch ?? fetch;
  const wait = options.wait ?? ((ms) => new Promise<void>((done) => setTimeout(done, ms)));
  for (;;) {
    const response = await send(
      new Request(new URL("/devices/relocate", relocation.upstream), {
        method: "POST",
        headers: { "content-type": "application/json", "x-shopper-org": identity.orgId },
        body: JSON.stringify({
          orgId: identity.orgId,
          deviceId: identity.deviceId,
          code: relocation.code,
        }),
      }),
    );
    // The box hands relocations out as soon as the cloud has the files; the import may still be running.
    if (response.status === 409) {
      await wait(STILL_MOVING_MS);
      continue;
    }
    const result = v.safeParse(enrollmentResult, await response.json().catch(() => null));
    if (!response.ok || !result.success)
      throw new Error(`The cloud refused this register's relocation (${response.status}).`);
    return {
      upstream: relocation.upstream,
      deviceToken: result.output.deviceToken,
      receiptCodes: result.output.receiptCodes,
    };
  }
}

/**
 * The handshake hook with relocation folded in: a relocation the handshake carries is followed once, and the parent
 * (Electron) is told to rewrite the register file and restart on the cloud.
 */
export function withRelocation<T extends { relocation?: unknown }>(
  next: (result: T) => void,
  identity: { orgId: string; deviceId: string },
  send: (message: unknown) => void,
) {
  let relocating = false;
  return (result: T) => {
    next(result);
    if (result.relocation === undefined || relocating) return;
    relocating = true;
    void relocateRegister(identity, result.relocation, { issuer: buildInfo.licenceIssuer })
      .then((registration) => registration && send({ type: "relocated", registration }))
      .catch((error: unknown) => console.error({ event: "till.relocate_failed", error }))
      .finally(() => {
        relocating = false;
      });
  };
}
